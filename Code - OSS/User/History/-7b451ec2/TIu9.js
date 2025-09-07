// backend/services/scoring.js

const db = require('../db.js'); // Make sure the path is correct
const getDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

const runDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)) });
});

// --- Helper functions for each score component ---

/**
 * Calculates the task score for a given date based on your defined logic.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<number>} The calculated task score.
 */
function calculateTaskScore(date) { // Returns value like 0.0 to N.0 (e.g. 1.0 for 100%, 2.0 for 200%)
    // ... (existing logic is fine, it already returns num_completed / num_assigned)
    return new Promise((resolve, reject) => {
        // ... your existing implementation returns the raw ratio ...
        const completedSql = `SELECT COUNT(*) as count FROM Tasks WHERE completion_date = ? OR (target_date = ? AND is_done = TRUE)`; // Ensure we count all tasks done *for* that day
        const assignedSql = `SELECT COUNT(*) as count FROM Tasks WHERE target_date = ? AND is_assigned = TRUE`;

        db.get(completedSql, [date, date], (err, completedRow) => {
            if (err) return reject(new Error(`DB error fetching completed tasks: ${err.message}`));
            const num_completed_today = completedRow.count;

            db.get(assignedSql, [date], (err, assignedRow) => {
                if (err) return reject(new Error(`DB error fetching assigned tasks: ${err.message}`));
                const num_assigned_for_today = assignedRow.count;

                let task_score_raw = 0;
                if (num_assigned_for_today > 0) {
                    task_score_raw = num_completed_today / num_assigned_for_today;
                } else {
                    if (num_completed_today > 0) {
                        task_score_raw = num_completed_today;
                    } else {
                        task_score_raw = 1.0;
                    }
                }
                resolve(task_score_raw);
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

function calculateHabitScore(date) { // Returns sum of weights, e.g. 0.0 to 1.0 (or more if weights don't sum to 1)
    // ... (existing logic is fine, it returns sum of weight_at_completion)
    return new Promise((resolve, reject) => {
        const sql = `SELECT SUM(weight_at_completion) as score FROM HabitCompletions WHERE completion_date = ?`;
        db.get(sql, [date], (err, row) => {
            if (err) return reject(new Error(`DB error fetching habit completions: ${err.message}`));
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


function calculateTimeScore(date) { // Returns (P-D)*10, e.g. 30 for 3 net productive hours
    // ... (existing logic is fine)
    return new Promise((resolve, reject) => {
        // ... your existing implementation ...
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

            const time_score_raw = (productiveHours - distractingHours) * 10;
            resolve(time_score_raw);
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
    const dailyStatusRow = await getDb('SELECT is_manually_marked_rest_day FROM DailyScores WHERE date = ?', [date]);
    const isRestDay = dailyStatusRow ? (dailyStatusRow.is_manually_marked_rest_day === 1) : false;
    try {

        const [task_score_ratio, habit_score_sum_weights, time_score_points] = await Promise.all([
            calculateTaskScore(date),
            calculateHabitScore(date),
            calculateTimeScore(date)
        ]);

        // --- SCALING TO 0-100 POINT SYSTEM (or more for tasks) ---
        const habit_points = habit_score_sum_weights * 100;
        const task_points = task_score_ratio * 100;
        // time_score_points is already in the "points" scale we want for its component.

        // 3. Determine previous day's streak (keep this logic)
        const prevDate = new Date(new Date(date + 'T00:00:00').setDate(new Date(date + 'T00:00:00').getDate() - 1)).toISOString().slice(0, 10);
        const prevStreakData = await getDb('SELECT current_streak_days FROM StreakData WHERE date = ?', [prevDate]);
        const prevDayStreak = prevStreakData ? prevStreakData.current_streak_days : 0;

        let current_streak_days_for_bonus = prevDayStreak;
        let new_streak_days_for_storage = 0;

        // 4. Calculate base daily score using the new POINT systems before final weighting
        const base_daily_score = (habit_points * 0.45) +
            (task_points * 0.45) +
            (time_score_points * 0.1); // time_score_points is already the (P-D)*10 value

        // 5. Streak Logic (keep this logic, using the REAL '60' threshold now)
        if (isRestDay) {
            new_streak_days_for_storage = prevDayStreak;
        } else if (base_daily_score >= 60) { // <<-- KEEP THIS AT 60
            new_streak_days_for_storage = prevDayStreak + 1;
            current_streak_days_for_bonus = new_streak_days_for_storage;
        } else {
            new_streak_days_for_storage = 0;
            current_streak_days_for_bonus = 0;
        }

        // 6. Calculate Streak Bonus (keep this logic)
        let streak_bonus_component = 0;
        if (current_streak_days_for_bonus > 0) {
            streak_bonus_component = Math.round(Math.log2(2 + (current_streak_days_for_bonus / 365)) * 100) / 100;
        }

        // 7. Calculate final total daily score
        const total_daily_score = base_daily_score + streak_bonus_component;

        // 8. Prepare data for DailyScores DB
        // We should store the POINT values (0-100 scale) in the DB for clarity, not the original ratios
        const scoreDataForDb = {
            date: date,
            habit_score_component: habit_points,     // Store scaled habit points
            task_score_component: task_points,      // Store scaled task points
            time_score_component: time_score_points, // Store raw time points ((P-D)*10)
            streak_bonus_component: streak_bonus_component,
            total_daily_score: total_daily_score,
            is_manually_marked_rest_day: isRestDay ? 1 : 0
        };

        // ... (9. Upsert into DailyScores - keep as is)
        // ... (10. Upsert into StreakData - keep as is)
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

        const streakDataSql = `
    INSERT INTO StreakData (date, current_streak_days)
    VALUES (?, ?)
    ON CONFLICT(date) DO UPDATE SET
        current_streak_days = excluded.current_streak_days,
        updated_at = CURRENT_TIMESTAMP;
`;
        await runDb(streakDataSql, [date, new_streak_days_for_storage]);
        console.log(`Streak data for ${date} updated. Current streak: ${new_streak_days_for_storage} days.`);

        return scoreDataForDb;

    } catch (error) {
        console.error(`Error in recalculateDailyScore for date ${date}:`, error.message);
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
