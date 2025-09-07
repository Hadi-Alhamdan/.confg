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
function calculateTaskScore(date) {
    return new Promise((resolve, reject) => {
        // Only count tasks that are marked as done AND are for the target_date
        const completedSql = `SELECT COUNT(*) as count FROM Tasks WHERE target_date = ? AND is_done = TRUE`;
        const assignedSql = `SELECT COUNT(*) as count FROM Tasks WHERE target_date = ? AND is_assigned = TRUE`;

        db.get(completedSql, [date], (err, completedRow) => { // Only need 'date' once here
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
                        task_score_raw = 0.0; // 0 assigned, 0 completed
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

function calculateHabitScore(date) {
    return new Promise((resolve, reject) => {
        // Log the completions it's about to sum
        const logCompletionsSql = `SELECT habit_id, weight_at_completion FROM HabitCompletions WHERE completion_date = ?`;
        db.all(logCompletionsSql, [date], (logErr, completionRows) => {
            if (logErr) console.error(`Error fetching details for habit score log for ${date}: ${logErr.message}`);
            else console.log(`Habit Score Calc Details for ${date}: Completions found = `, completionRows);

            const sumSql = `SELECT SUM(weight_at_completion) as score, COUNT(*) as count FROM HabitCompletions WHERE completion_date = ?`;
            db.get(sumSql, [date], (err, row) => {
                if (err) return reject(new Error(`DB error fetching habit completions: ${err.message}`));
                console.log(`Habit Score Calc for ${date}: Raw DB Sum of weights = ${row.score}, Count = ${row.count}`);
                resolve(row.score || 0);
            });
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
    console.log(`\n--- Recalculating Daily Score for Date: ${date} ---`);
    try {
        // 1. Determine if it's a Rest Day for the current 'date'
        const dailyStatusRow = await getDb('SELECT is_manually_marked_rest_day FROM DailyScores WHERE date = ?', [date]);
        const isRestDay = dailyStatusRow ? (dailyStatusRow.is_manually_marked_rest_day === 1) : false;
        console.log(`Is ${date} a rest day? ${isRestDay}`);

        // 2. Calculate raw component scores and scale them
        const [task_score_ratio, habit_score_sum_weights, time_score_points] = await Promise.all([
            calculateTaskScore(date),
            calculateHabitScore(date),
            calculateTimeScore(date)
        ]);

        const habit_points = habit_score_sum_weights * 100;
        const task_points = task_score_ratio * 100;
        // time_score_points is already scaled

        console.log(`Raw scores for ${date}: Habit Sum Weights=${habit_score_sum_weights.toFixed(2)}, Task Ratio=${task_score_ratio.toFixed(2)}, Time Points=${time_score_points.toFixed(2)}`);
        console.log(`Scaled points for ${date}: Habit Points=${habit_points.toFixed(2)}, Task Points=${task_points.toFixed(2)}`);

        // 3. Determine previous day's streak
        const currentDayParts = date.split('-').map(Number); // [YYYY, MM, DD]
        const prevDateObj = new Date(Date.UTC(currentDayParts[0], currentDayParts[1] - 1, currentDayParts[2]));
        prevDateObj.setUTCDate(prevDateObj.getUTCDate() - 1);
        const prevDate = prevDateObj.toISOString().slice(0, 10);

        const prevStreakData = await getDb('SELECT current_streak_days FROM StreakData WHERE date = ?', [prevDate]);
        const prevDayStreak = prevStreakData ? prevStreakData.current_streak_days : 0;
        console.log(`For date ${date}, previous date is ${prevDate}. Previous day's streak: ${prevDayStreak}`);

        // 4. Calculate base daily score (using scaled points and weights)
        const base_daily_score = (habit_points * 0.45) +
            (task_points * 0.45) +
            (time_score_points * 0.1);
        console.log(`Base daily score for ${date} (before bonus): ${base_daily_score.toFixed(2)}`);

        // 5. Streak Logic: Determine new streak for *this* day and streak for bonus calculation
        let new_streak_days_for_storage = 0;
        let current_streak_days_for_bonus = prevDayStreak; // Start with prev day's streak for bonus calc

        if (isRestDay) {
            new_streak_days_for_storage = prevDayStreak; // Streak carries over on rest days
            // current_streak_days_for_bonus remains prevDayStreak (no increment, no reset on bonus due to rest)
        } else if (base_daily_score >= 60) {
            new_streak_days_for_storage = prevDayStreak + 1;
            current_streak_days_for_bonus = new_streak_days_for_storage; // Bonus based on the new incremented streak
        } else {
            new_streak_days_for_storage = 0; // Streak resets
            current_streak_days_for_bonus = 0; // No bonus if streak reset today
        }
        console.log(`Streak logic for ${date}: New streak for storage = ${new_streak_days_for_storage}, Streak for bonus calc = ${current_streak_days_for_bonus}`);

        // 6. Calculate Streak Bonus for *this* day
        let streak_bonus_component = 0;
        if (current_streak_days_for_bonus > 0) {
            streak_bonus_component = Math.round(Math.log2(2 + (current_streak_days_for_bonus / 365)) * 100) / 100;
        }
        console.log(`Streak bonus component for ${date}: ${streak_bonus_component.toFixed(2)}`);

        // 7. Calculate final total daily score
        const total_daily_score = base_daily_score + streak_bonus_component;
        console.log(`Final total daily score for ${date}: ${total_daily_score.toFixed(2)}`);

        // 8. Prepare data for DailyScores DB
        const scoreDataForDb = {
            date: date,
            habit_score_component: habit_points,
            task_score_component: task_points,
            time_score_component: time_score_points,
            streak_bonus_component: streak_bonus_component,
            total_daily_score: total_daily_score,
            is_manually_marked_rest_day: isRestDay ? 1 : 0
        };

        // 9. Upsert into DailyScores
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
        console.log(`-> DailyScores table updated for ${date}.`);

        // 10. Upsert into StreakData for *this* day
        const streakDataSql = `
            INSERT INTO StreakData (date, current_streak_days)
            VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET
                current_streak_days = excluded.current_streak_days,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await runDb(streakDataSql, [date, new_streak_days_for_storage]);
        console.log(`-> StreakData table updated for ${date}. Stored streak: ${new_streak_days_for_storage} days.`);

        return scoreDataForDb;

    } catch (error) {
        console.error(`Error in recalculateDailyScore for date ${date}:`, error);
        throw error;
    }
}



/**
 * Recalculates streaks and associated daily score bonuses from a given start date up to the most recent entry.
 * This should be called after a change to a past day's score or rest status might have altered its streak contribution.
 * @param {string} startDateToRecalculateFrom - The first date (YYYY-MM-DD) whose streak might have changed.
 */


async function recalculateStreaksForward(startDateToRecalculateFrom) {
    console.log(`[StreakForward] Starting forward streak recalculation from ${startDateToRecalculateFrom}...`);

    // Determine the last date with a score entry to define the end of our loop.
    const lastScoreDateRow = await getDb("SELECT MAX(date) as max_date FROM DailyScores");
    if (!lastScoreDateRow || !lastScoreDateRow.max_date) {
        console.log("[StreakForward] No scores found in DailyScores table. Nothing to recalculate.");
        return;
    }
    const lastDayInLoop = lastScoreDateRow.max_date;

    // Ensure the start date for recalculation is not after the last known scored day.
    if (new Date(startDateToRecalculateFrom) > new Date(lastDayInLoop)) {
        console.log(`[StreakForward] Start date ${startDateToRecalculateFrom} is after last scored date ${lastDayInLoop}. No forward recalculation needed.`);
        return;
    }

    // Initialize loop variables using UTC to avoid timezone issues.
    let currentDate = new Date(Date.UTC(
        parseInt(startDateToRecalculateFrom.substring(0, 4)),
        parseInt(startDateToRecalculateFrom.substring(5, 7)) - 1, // Month is 0-indexed
        parseInt(startDateToRecalculateFrom.substring(8, 10))
    ));
    const stopDateLoop = new Date(Date.UTC(
        parseInt(lastDayInLoop.substring(0, 4)),
        parseInt(lastDayInLoop.substring(5, 7)) - 1,
        parseInt(lastDayInLoop.substring(8, 10))
    ));

    while (currentDate <= stopDateLoop) {
        const currentDateStr = currentDate.toISOString().slice(0, 10);
        console.log(`[StreakForward] --- Processing: ${currentDateStr} ---`);

        // 1. Fetch the DailyScores entry for the current day.
        // We need its components to derive the base score, its old bonus, and its rest day status.
        const dailyScoreEntry = await getDb(
            "SELECT habit_score_component, task_score_component, time_score_component, streak_bonus_component, is_manually_marked_rest_day FROM DailyScores WHERE date = ?",
            [currentDateStr]
        );

        if (!dailyScoreEntry) {
            // This case should ideally be rare if recalculateDailyScore was called for this day after a data change.
            // If a day that *should* have a score (because its underlying data changed) doesn't,
            // it implies a potential gap in when recalculateDailyScore is triggered.
            // For robustness, we could trigger a full recalculateDailyScore here,
            // but that might make the loop much slower and could indicate a deeper issue.
            // For now, we'll warn and skip, assuming that if a day's core data changes,
            // recalculateDailyScore (which creates the DailyScores entry) is called first.
            console.warn(`[StreakForward] No DailyScores entry found for ${currentDateStr}. Skipping its streak forward update. This day's base score is unknown.`);
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
            continue;
        }

        // Calculate the base score for this day (total score MINUS its previously calculated streak bonus).
        // The components stored are already the scaled "points" (e.g., habit points, task points).
        const baseScoreForThisDay = (dailyScoreEntry.habit_score_component * 0.45) +
            (dailyScoreEntry.task_score_component * 0.45) +
            (dailyScoreEntry.time_score_component * 0.1);
        const isRestDay = dailyScoreEntry.is_manually_marked_rest_day === 1;
        const oldBonus = dailyScoreEntry.streak_bonus_component;

        // 2. Get the streak from the day *immediately preceding* the current loop day.
        const prevLoopDateObj = new Date(currentDate); // Clone current date
        prevLoopDateObj.setUTCDate(prevLoopDateObj.getUTCDate() - 1);
        const prevLoopDateStr = prevLoopDateObj.toISOString().slice(0, 10);

        const prevDayStreakData = await getDb('SELECT current_streak_days FROM StreakData WHERE date = ?', [prevLoopDateStr]);
        const actualPrevDayStreak = prevDayStreakData ? prevDayStreakData.current_streak_days : 0;

        console.log(`[StreakForward] For ${currentDateStr}: Prev Day (${prevLoopDateStr}) Streak = ${actualPrevDayStreak}. BaseScore = ${baseScoreForThisDay.toFixed(2)}, IsRest = ${isRestDay}`);

        // 3. Determine the new streak value for the current day based on the previous day's *actual* streak
        //    and the current day's score and rest status.
        let newStreakForCurrentDay_storage; // This is what gets stored in StreakData for *this* day
        let streakUsedForBonusCalculation = actualPrevDayStreak; // Basis for *this* day's bonus

        if (isRestDay) {
            newStreakForCurrentDay_storage = actualPrevDayStreak; // Streak carries over
            // Bonus for a rest day is typically based on the streak *entering* the rest day
        } else if (baseScoreForThisDay >= 60) {
            newStreakForCurrentDay_storage = actualPrevDayStreak + 1;
            streakUsedForBonusCalculation = newStreakForCurrentDay_storage; // Bonus uses the new, incremented streak
        } else {
            newStreakForCurrentDay_storage = 0; // Streak resets
            streakUsedForBonusCalculation = 0; // No bonus if streak reset today
        }

        // 4. Update the StreakData table for the current day with its new streak value.
        await runDb(`
            INSERT INTO StreakData (date, current_streak_days) VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET current_streak_days = excluded.current_streak_days, updated_at = CURRENT_TIMESTAMP
        `, [currentDateStr, newStreakForCurrentDay_storage]);
        console.log(`[StreakForward] -> Updated StreakData for ${currentDateStr} to ${newStreakForCurrentDay_storage} days.`);

        // 5. Recalculate the streak bonus for the current day using `streakUsedForBonusCalculation`.
        let newBonus = 0;
        if (streakUsedForBonusCalculation > 0) {
            newBonus = Math.round(Math.log2(2 + (streakUsedForBonusCalculation / 365)) * 100) / 100;
        }

        // 6. If the newly calculated bonus is different from the old bonus stored for this day,
        //    update the DailyScores table.
        if (newBonus !== oldBonus) {
            const newTotalScoreForThisDay = baseScoreForThisDay + newBonus;
            await runDb(`
                UPDATE DailyScores 
                SET streak_bonus_component = ?, total_daily_score = ?, updated_at = CURRENT_TIMESTAMP
                WHERE date = ?
            `, [newBonus, newTotalScoreForThisDay, currentDateStr]);
            console.log(`[StreakForward] -> Updated DailyScores for ${currentDateStr}: OldBonus ${oldBonus.toFixed(2)}, NewBonus ${newBonus.toFixed(2)}, NewTotal ${newTotalScoreForThisDay.toFixed(2)}`);
        } else {
            console.log(`[StreakForward] -> Bonus for ${currentDateStr} (${newBonus.toFixed(2)}) unchanged. No DailyScore update for bonus.`);
        }

        // Move to the next day in the loop.
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }
    console.log("[StreakForward] Forward streak recalculation loop completed.");
}


module.exports = {
    recalculateDailyScore,
    recalculateStreaksForward
};