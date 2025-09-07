// backend/services/scoring.js

const db = require('../db.js'); // Make sure the path is correct
const getDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const runDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { (err ? reject(err) : resolve(this)) });
});

// --- Helper functions for each score component ---

/**
 * Calculates the task score for a given date based on your defined logic.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<number>} The calculated task score.
 */
function calculateTaskScore(date) {
    return new Promise((resolve, reject) => {
        const completedSql = `SELECT COUNT(*) as count FROM Tasks WHERE completion_date = ?`;
        const assignedSql = `SELECT COUNT(*) as count FROM Tasks WHERE target_date = ? AND is_assigned = TRUE`;

        db.get(completedSql, [date], (err, completedRow) => {
            if (err) return reject(new Error(`DB error fetching completed tasks: ${err.message}`));
            const num_completed_today = completedRow.count;

            db.get(assignedSql, [date], (err, assignedRow) => {
                if (err) return reject(new Error(`DB error fetching assigned tasks: ${err.message}`));
                const num_assigned_for_today = assignedRow.count;

                let task_score = 0;
                if (num_assigned_for_today > 0) {
                    task_score = num_completed_today / num_assigned_for_today;
                } else { // num_assigned_for_today is 0
                    if (num_completed_today > 0) {
                        task_score = num_completed_today; // Equivalent to num_completed / 1
                    } else { // 0 assigned, 0 completed
                        task_score = 1.0;
                    }
                }
                resolve(task_score);
            });
        });
    });
}

/**
 * Calculates the habit score for a given date.
 * This is the sum of the weights of completed habits for that day.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<number>} The calculated habit score.
 */
function calculateHabitScore(date) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT SUM(weight_at_completion) as score FROM HabitCompletions WHERE completion_date = ?`;
        db.get(sql, [date], (err, row) => {
            if (err) return reject(new Error(`DB error fetching habit completions: ${err.message}`));
            // If no habits were completed, row.score will be NULL. Default to 0.
            resolve(row.score || 0);
        });
    });
}

/**
 * Calculates the time score for a given date.
 * (Productive Hours - Distracting Hours) * 10
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<number>} The calculated time score.
 */
function calculateTimeScore(date) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                SUM(CASE WHEN type = 'productive' THEN duration_minutes ELSE 0 END) as productive,
                SUM(CASE WHEN type = 'distracting' THEN duration_minutes ELSE 0 END) as distracting
            FROM TimeLogs 
            WHERE date_logged_for = ?`;
        
        db.get(sql, [date], (err, row) => {
            if (err) return reject(new Error(`DB error fetching time logs: ${err.message}`));
            const productiveMinutes = row.productive || 0;
            const distractingMinutes = row.distracting || 0;
            
            const productiveHours = productiveMinutes / 60.0;
            const distractingHours = distractingMinutes / 60.0;

            const time_score = (productiveHours - distractingHours) * 10;
            resolve(time_score);
        });
    });
}



/**
 * The main orchestrator function. Fetches component scores, calculates the total,
 * handles streak logic, and saves scores to DailyScores and StreakData tables.
 * @param {string} date - The date to recalculate for ('YYYY-MM-DD').
 * @returns {Promise<Object>} A promise that resolves to the final calculated scores object.
 */
async function recalculateDailyScore(date) {
    try {
        // 1. Fetch settings to check for rest days
        const settings = await getDb('SELECT * FROM Settings WHERE id = 1');
        const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0=Sunday, 1=Monday,...
        let isRestDay = false;
        if (settings) {
            const restDayKeys = ['rest_day_sunday', 'rest_day_monday', 'rest_day_tuesday', 'rest_day_wednesday', 'rest_day_thursday', 'rest_day_friday', 'rest_day_saturday'];
            isRestDay = settings[restDayKeys[dayOfWeek]] === 1; // SQLite stores boolean as 1 or 0
        }

        // 2. Fetch all component scores in parallel
        const [task_score_raw, habit_score_raw, time_score_raw] = await Promise.all([
            calculateTaskScore(date),
            calculateHabitScore(date),
            calculateTimeScore(date)
        ]);

        // 3. Determine previous day's streak
        const prevDate = new Date(new Date(date + 'T00:00:00').setDate(new Date(date + 'T00:00:00').getDate() - 1)).toISOString().slice(0, 10);
        const prevStreakData = await getDb('SELECT current_streak_days FROM StreakData WHERE date = ?', [prevDate]);
        const prevDayStreak = prevStreakData ? prevStreakData.current_streak_days : 0;

        let current_streak_days_for_bonus = prevDayStreak; // For calculating bonus for *this* day
        let new_streak_days_for_storage = 0; // For storing in StreakData for *this* day

        // 4. Calculate base daily score (without streak bonus yet)
        const base_daily_score = (habit_score_raw * 0.45) + (task_score_raw * 0.45) + (time_score_raw * 0.1);
        
        // 5. Streak Logic: Determine if streak continues or resets for *this* day
        if (isRestDay) {
            new_streak_days_for_storage = prevDayStreak; // Streak carries over on rest days
        } else if (base_daily_score >= 1) {
            new_streak_days_for_storage = prevDayStreak + 1;
            current_streak_days_for_bonus = new_streak_days_for_storage; // Bonus is based on the new incremented streak
        } else {
            new_streak_days_for_storage = 0; // Streak resets
            current_streak_days_for_bonus = 0; // No bonus if streak reset today
        }

        // 6. Calculate Streak Bonus for *this* day using the appropriate streak count
        // streak bonus = round(log2(1+(streak days / 365)+1)*100)/100
        // Simplified: round(log2(2 + (streak days / 365)) * 100) / 100
        let streak_bonus_component = 0;
        if (current_streak_days_for_bonus > 0) { // Only apply bonus if there's a streak
           streak_bonus_component = Math.round(Math.log2(2 + (current_streak_days_for_bonus / 365)) * 100) / 100;
        }

        // 7. Calculate final total daily score
        const total_daily_score = base_daily_score + streak_bonus_component;

        // 8. Prepare data for DailyScores DB
        const scoreDataForDb = {
            date: date,
            habit_score_component: habit_score_raw,
            task_score_component: task_score_raw,
            time_score_component: time_score_raw,
            streak_bonus_component: streak_bonus_component,
            total_daily_score: total_daily_score
        };

        // 9. Upsert into DailyScores
        const dailyScoreSql = `
            INSERT INTO DailyScores (date, habit_score_component, task_score_component, time_score_component, streak_bonus_component, total_daily_score)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(date) DO UPDATE SET
                habit_score_component = excluded.habit_score_component,
                task_score_component = excluded.task_score_component,
                time_score_component = excluded.time_score_component,
                streak_bonus_component = excluded.streak_bonus_component,
                total_daily_score = excluded.total_daily_score,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await runDb(dailyScoreSql, Object.values(scoreDataForDb));
        console.log(`Daily score for ${date} recalculated. Base: ${base_daily_score.toFixed(2)}, Bonus: ${streak_bonus_component.toFixed(2)}, Total: ${total_daily_score.toFixed(2)}`);

        // 10. Upsert into StreakData for *this* day
        const streakDataSql = `
            INSERT INTO StreakData (date, current_streak_days)
            VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET
                current_streak_days = excluded.current_streak_days,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await runDb(streakDataSql, [date, new_streak_days_for_storage]);
        console.log(`Streak data for ${date} updated. Current streak: ${new_streak_days_for_storage} days.`);
        
        // Important: What this function returns is the score for 'date', used by daily-score endpoint
        return scoreDataForDb;

    } catch (error) {
        console.error(`Error in recalculateDailyScore for date ${date}:`, error);
        throw error; // Re-throw to be caught by calling route handlers
    }
}

module.exports = {
    recalculateDailyScore
    // You could also export the individual calculators if needed elsewhere, but not necessary for now
    // calculateTaskScore,
    // calculateHabitScore,
    // calculateTimeScore
};

module.exports = {
    recalculateDailyScore
};