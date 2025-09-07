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
 * and saves it to the DailyScores table.
 * @param {string} date - The date to recalculate for ('YYYY-MM-DD').
 * @returns {Promise<Object>} A promise that resolves to the final calculated scores object.
 */
async function recalculateDailyScore(date) {
    try {
        // We will add streak bonus calculation later in Phase 5. For now, it's 0.
        const streak_bonus_component = 0;

        // Fetch all component scores in parallel
        const [task_score_raw, habit_score_raw, time_score_raw] = await Promise.all([
            calculateTaskScore(date),
            calculateHabitScore(date),
            calculateTimeScore(date)
        ]);

        // Apply weights from your formula
        const task_score_component = task_score_raw * 0.45;
        const habit_score_component = habit_score_raw * 0.45;
        const time_score_component = time_score_raw * 0.1;

        // Calculate final score
        // NOTE: Your formula uses the raw task score, not the weighted one. Let's adjust.
        // Formula: sum(habit_in_day) * 0.45 + final_task_score * 0.45 + final_time_score * 0.1
        // `habit_score_raw` is sum(habit_in_day)
        // `task_score_raw` is final_task_score
        // `time_score_raw` is final_time_score
        const total_daily_score = (habit_score_raw * 0.45) + (task_score_raw * 0.45) + (time_score_raw * 0.1) + streak_bonus_component;

        // Prepare data for DB
        const scoreData = {
            date: date,
            habit_score_component: habit_score_raw, // Storing raw score before weighting
            task_score_component: task_score_raw,
            time_score_component: time_score_raw,
            streak_bonus_component: streak_bonus_component,
            total_daily_score: total_daily_score
        };

        // Use INSERT OR UPDATE (Upsert) to save the score
        const sql = `
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

        const params = [
            scoreData.date, 
            scoreData.habit_score_component, 
            scoreData.task_score_component, 
            scoreData.time_score_component, 
            scoreData.streak_bonus_component, 
            scoreData.total_daily_score
        ];
        
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) return reject(new Error(`DB error saving daily score: ${err.message}`));
                console.log(`Daily score for ${date} recalculated and saved. Total: ${total_daily_score.toFixed(2)}`);
                // TODO LATER: After saving, trigger streak calculation.
                resolve(scoreData);
            });
        });

    } catch (error) {
        console.error(`Error in recalculateDailyScore for date ${date}:`, error);
        // Re-throw the error so the calling function knows something went wrong
        throw error;
    }
}

module.exports = {
    recalculateDailyScore
};