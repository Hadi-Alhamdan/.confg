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
    try {
        const dailyStatusRow = await getDb('SELECT is_manually_marked_rest_day FROM DailyScores WHERE date = ?', [date]);
        const isRestDay = dailyStatusRow ? (dailyStatusRow.is_manually_marked_rest_day === 1) : false;

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
    INSERT INTO DailyScores (date, habit_score_component, task_score_component, time_score_component, streak_bonus_component, total_daily_score, is_manually_marked_rest_day)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
        habit_score_component = excluded.habit_score_component,
        task_score_component = excluded.task_score_component,
        time_score_component = excluded.time_score_component,
        streak_bonus_component = excluded.streak_bonus_component,
        total_daily_score = excluded.total_daily_score,
        is_manually_marked_rest_day = excluded.is_manually_marked_rest_day,
        updated_at = CURRENT_TIMESTAMP;
`;
        await runDb(dailyScoreSql, Object.values(scoreDataForDb));
        console.log(`Daily score for ${date} recalculated. Base: ${base_daily_score.toFixed(2)}, Bonus: ${streak_bonus_component.toFixed(2)}, Total: ${total_daily_score.toFixed(2)}, Rest: ${isRestDay}`);

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


/**
 * Recalculates streaks and associated daily score bonuses from a given start date up to the most recent entry.
 * This should be called after a change to a past day's score or rest status might have altered its streak contribution.
 * @param {string} startDateToRecalculateFrom - The first date (YYYY-MM-DD) whose streak might have changed.
 */

async function recalculateStreaksForward(startDateToRecalculateFrom) {
    console.log(`Starting forward streak recalculation from ${startDateToRecalculateFrom}...`);

    // Find the last date we have any data for (either in DailyScores or StreakData)
    // to determine how far forward we need to recalculate.
    const lastScoreDateRow = await getDb("SELECT MAX(date) as max_date FROM DailyScores");
    const lastStreakDateRow = await getDb("SELECT MAX(date) as max_date FROM StreakData");
    
    let lastKnownDate = lastScoreDateRow.max_date || "1970-01-01";
    if (lastStreakDateRow.max_date && lastStreakDateRow.max_date > lastKnownDate) {
        lastKnownDate = lastStreakDateRow.max_date;
    }
    
    // If startDateToRecalculateFrom is after the last known date, nothing to do.
    if (new Date(startDateToRecalculateFrom) > new Date(lastKnownDate)) {
        console.log("Recalculation start date is after last known data. No forward recalculation needed.");
        return;
    }
    
    let currentDate = new Date(Date.UTC(
        parseInt(startDateToRecalculateFrom.substring(0, 4)),
        parseInt(startDateToRecalculateFrom.substring(5, 7)) - 1,
        parseInt(startDateToRecalculateFrom.substring(8, 10))
    ));
    const stopDate = new Date(Date.UTC(
        parseInt(lastKnownDate.substring(0, 4)),
        parseInt(lastKnownDate.substring(5, 7)) - 1,
        parseInt(lastKnownDate.substring(8, 10))
    ));

    let previousDayStreakValue = -1; // Placeholder to detect first iteration

    while (currentDate <= stopDate) {
        const currentDateStr = currentDate.toISOString().slice(0, 10);
        console.log(`Recalculating streak for: ${currentDateStr}`);

        // 1. Get this day's score and rest status from DailyScores
        const dailyScoreEntry = await getDb("SELECT total_daily_score, streak_bonus_component, is_manually_marked_rest_day FROM DailyScores WHERE date = ?", [currentDateStr]);
        
        if (!dailyScoreEntry) {
            console.log(`No DailyScore entry for ${currentDateStr}, cannot recalculate streak. Skipping.`);
            // If no score entry, we can't determine if it met threshold. Assume streak breaks if not rest.
            // Or, one could argue recalculateDailyScore should be called for this day first.
            // For now, we'll skip to avoid creating new score entries here unless specifically designed.
            // This implies that any day involved in a streak calculation should ideally already have
            // a DailyScores entry (even if score is 0). recalculateDailyScore ensures this.
            
            // Let's try to ensure a score entry exists by calling recalculateDailyScore if none found
            // This is a bit more robust.
            let scoreToUse, isRestDay, oldBonus;
            const existingScore = await getDb("SELECT total_daily_score, streak_bonus_component, is_manually_marked_rest_day FROM DailyScores WHERE date = ?", [currentDateStr]);
            if (existingScore) {
                scoreToUse = existingScore.total_daily_score - existingScore.streak_bonus_component; // Base score
                isRestDay = existingScore.is_manually_marked_rest_day === 1;
                oldBonus = existingScore.streak_bonus_component;
            } else {
                // If no score, calculate it now. This will also create the DailyScores entry.
                // recalculateDailyScore itself handles streak for this day based on ITS previous day.
                // We are essentially re-evaluating the streak part.
                console.log(`No DailyScore for ${currentDateStr}. Triggering full recalculateDailyScore first.`);
                const fullRecalc = await recalculateDailyScore(currentDateStr); // This will update StreakData for currentDateStr
                scoreToUse = fullRecalc.total_daily_score - fullRecalc.streak_bonus_component;
                isRestDay = fullRecalc.is_manually_marked_rest_day === 1;
                oldBonus = fullRecalc.streak_bonus_component; // This is the bonus calculated by fullRecalc
                previousDayStreakValue = (await getDb('SELECT current_streak_days FROM StreakData WHERE date = ?', [currentDateStr])).current_streak_days;
                currentDate.setUTCDate(currentDate.getUTCDate() + 1); // Move to next day as fullRecalc handled this one
                continue; 
            }


        // 2. Get the streak from the day *before* current_date_str
        const prevLoopDate = new Date(currentDate); // Clone current date
        prevLoopDate.setUTCDate(prevLoopDate.getUTCDate() - 1);
        const prevLoopDateStr = prevLoopDate.toISOString().slice(0, 10);
        
        const prevDayStreakData = await getDb('SELECT current_streak_days FROM StreakData WHERE date = ?', [prevLoopDateStr]);
        const actualPrevDayStreak = prevDayStreakData ? prevDayStreakData.current_streak_days : 0;

        // 3. Calculate new streak for current_date_str
        let newStreakForCurrentDay;
        let currentStreakForBonusCalc = actualPrevDayStreak;

        if (isRestDay) {
            newStreakForCurrentDay = actualPrevDayStreak;
        } else if (scoreToUse >= 60) { // scoreToUse is base score
            newStreakForCurrentDay = actualPrevDayStreak + 1;
            currentStreakForBonusCalc = newStreakForCurrentDay;
        } else {
            newStreakForCurrentDay = 0;
            currentStreakForBonusCalc = 0;
        }

        // 4. Update StreakData for current_date_str
        await runDb(`
            INSERT INTO StreakData (date, current_streak_days) VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET current_streak_days = excluded.current_streak_days, updated_at = CURRENT_TIMESTAMP
        `, [currentDateStr, newStreakForCurrentDay]);
        console.log(` -> Updated StreakData for ${currentDateStr} to ${newStreakForCurrentDay} days.`);

        // 5. Recalculate bonus for current_date_str based on its (potentially new) streak contribution
        let newBonus = 0;
        if (currentStreakForBonusCalc > 0) {
            newBonus = Math.round(Math.log2(2 + (currentStreakForBonusCalc / 365)) * 100) / 100;
        }

        // 6. If bonus changed, update DailyScores for current_date_str
        if (newBonus !== oldBonus) {
            const newTotalScore = scoreToUse + newBonus;
            await runDb(`
                UPDATE DailyScores 
                SET streak_bonus_component = ?, total_daily_score = ?, updated_at = CURRENT_TIMESTAMP
                WHERE date = ?
            `, [newBonus, newTotalScore, currentDateStr]);
            console.log(` -> Updated DailyScores for ${currentDateStr}: Bonus ${newBonus.toFixed(2)}, Total ${newTotalScore.toFixed(2)}`);
        }
        
        previousDayStreakValue = newStreakForCurrentDay; // For the next iteration
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    console.log("Forward streak recalculation completed.");
}

module.exports = {
    recalculateDailyScore
    // You could also export the individual calculators if needed elsewhere, but not necessary for now
    // calculateTaskScore,
    // calculateHabitScore,
    // calculateTimeScore
};
