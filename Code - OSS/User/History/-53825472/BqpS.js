const express = require('express');
const db = require('./db.js');  // Your database setup
const cors = require('cors'); // For allowing Cross-Origin Resource Sharing

const habitRoutes = require('./routes/habits.js');
const taskRoutes = require('./routes/tasks.js');
const timeLogRoutes = require('./routes/timelogs.js');
const { recalculateDailyScore } = require('./services/scoring.js');
require('./services/scoring.js');
const { getDb: getDbUtil, runDb: runDbUtil, allDb: allDbUtil } = require('./utils/dbUtils.js');
const app = express();
const PORT = process.env.PORT || 3000; // Use environment port or default to 3000

// Middleware
app.use(cors()); // Allow all origins for now (can be configured more strictly)
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded request bodies
app.use('/api/habits', habitRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/timelogs', timeLogRoutes);

// --- API Routes ---

// Test Route
app.get('/api', (req, res) => {
    res.json({ message: "Welcome to the Productivity App API!" });
});

// --- New Route for Marking/Unmarking Rest Days ---
app.put('/api/daily-status/:date', async (req, res) => {
    const { date } = req.params;
    const { is_rest_day } = req.body; // Expecting { "is_rest_day": true/false }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid or missing date parameter. Use YYYY-MM-DD format." });
    }
    if (typeof is_rest_day !== 'boolean') {
        return res.status(400).json({ error: "Missing or invalid 'is_rest_day' field in body (must be true or false)." });
    }

    const runDb = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)) });
    });

    try {
        const sql = `
            INSERT INTO DailyScores (date, is_manually_marked_rest_day) 
            VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET 
                is_manually_marked_rest_day = excluded.is_manually_marked_rest_day,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await runDb(sql, [date, is_rest_day]);

        // After updating the rest day status, recalculate the score for that day
        // because it directly impacts the streak and potentially the streak bonus.
        const updatedScoreData = await recalculateDailyScore(date);

        res.json({
            message: `Status for date ${date} updated. Marked as rest: ${is_rest_day}`,
            updated_score_data: updatedScoreData // Send back the re-calculated score
        });

    } catch (error) {
        console.error(`Error updating daily status for ${date}:`, error.message);
        res.status(500).json({ error: "Failed to update daily status." });
    }
});

/** 
 * GET /api/daily-score/:date
 * Fetches the daily score for a given date.
 * If the score is not pre-calculated, it triggers a recalculation.
 */
app.get('/api/daily-score/:date', async (req, res) => {
    const { date } = req.params;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid or missing date parameter. Use YYYY-MM-DD format." });
    }

    try {
        // 1. Try to fetch a pre-calculated score
        const sqlFetch = `SELECT * FROM DailyScores WHERE date = ?`;
        db.get(sqlFetch, [date], async (err, row) => {
            if (err) {
                console.error(`DB Error fetching daily score for ${date}:`, err.message);
                return res.status(500).json({ error: "Failed to fetch daily score." });
            }

            if (row) {
                // Score found in DB, return it
                return res.json({ message: "success", data: row });
            } else {
                // Score not found, so calculate it, save it, and then return it
                console.log(`Daily score for ${date} not found in DB. Calculating now...`);
                try {
                    const calculatedScoreData = await recalculateDailyScore(date);
                    // The recalculateDailyScore function already saves it to the DB.
                    // We just need to return the data it resolved with.
                    return res.json({ message: "success", data: calculatedScoreData });
                } catch (recalcError) {
                    console.error(`Error recalculating score for ${date} on demand:`, recalcError.message);
                    return res.status(500).json({ error: "Failed to calculate daily score." });
                }
            }
        });
    } catch (error) { // Catch any unexpected errors from the outer try
        console.error(`Unexpected error in GET /api/daily-score/${date}:`, error.message);
        res.status(500).json({ error: "An unexpected error occurred." });
    }
});


app.get('/api/streak', async (req, res) => {
    try {
        // Get the most recent entry in StreakData, ordered by date descending
        const sql = `SELECT current_streak_days FROM StreakData ORDER BY date DESC LIMIT 1`;
        // We need to use the db wrappers if we haven't made db.get return a promise by default
        const getDbAsync = (sql, params = []) => new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
        });

        const latestStreakEntry = await getDbAsync(sql);

        const currentStreak = latestStreakEntry ? latestStreakEntry.current_streak_days : 0;

        res.json({
            message: "success",
            data: {
                current_streak_days: currentStreak
            }
        });
    } catch (error) {
        console.error("Error fetching current streak:", error.message);
        res.status(500).json({ error: "Failed to fetch current streak." });
    }
});

// --- Chart Data Routes --- 

/**
 * GET /api/scores/history
 * Fetches daily scores within a given date range.
 * Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
 */
app.get('/api/scores/history', async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate query parameters are required." });
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }
    if (new Date(startDate) > new Date(endDate)) {
        return res.status(400).json({ error: "startDate cannot be after endDate." });
    }

    // Helper to get all dates in a range

    function getDatesInRange(start, end) {
        const dates = [];
        // Parse the start and end dates as UTC to avoid timezone issues
        let currentDate = new Date(Date.UTC(
            parseInt(start.substring(0, 4)),
            parseInt(start.substring(5, 7)) - 1, // Month is 0-indexed
            parseInt(start.substring(8, 10))
        ));
        const stopDate = new Date(Date.UTC(
            parseInt(end.substring(0, 4)),
            parseInt(end.substring(5, 7)) - 1, // Month is 0-indexed
            parseInt(end.substring(8, 10))
        ));

        while (currentDate <= stopDate) {
            dates.push(currentDate.toISOString().slice(0, 10));
            // Increment date in UTC
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
        return dates;
    }

    const allDatesInRange = getDatesInRange(startDate, endDate);

    // Fetch scores from DB
    const sql = `SELECT date, total_daily_score FROM DailyScores WHERE date >= ? AND date <= ? ORDER BY date ASC`;

    // We need a promise wrapper for db.all if it's not already promise-based
    const dbAllAsync = (sqlQuery, params = []) => new Promise((resolve, reject) => {
        db.all(sqlQuery, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });

    try {
        const scoreRows = await dbAllAsync(sql, [startDate, endDate]);

        // Create a map for quick lookup of scores
        const scoresMap = new Map();
        scoreRows.forEach(row => {
            scoresMap.set(row.date, row.total_daily_score);
        });

        // Construct the final data, ensuring all dates in the range are present
        const chartData = allDatesInRange.map(dateStr => ({
            date: dateStr,
            total_daily_score: scoresMap.get(dateStr) || 0 // Default to 0 if no score for that day
        }));

        res.json({ message: "success", data: chartData });

    } catch (error) {
        console.error("Error fetching score history:", error.message);
        res.status(500).json({ error: "Failed to fetch score history." });
    }
});

// We'll need our promise-based db.all
const dbAllAsync = (sqlQuery, params = []) => new Promise((resolve, reject) => {
    db.all(sqlQuery, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

app.get('/api/data/export', async (req, res) => {
    try {
        const habits = await dbAllAsync("SELECT * FROM Habits");
        const habitCompletions = await dbAllAsync("SELECT * FROM HabitCompletions");
        const tasks = await dbAllAsync("SELECT * FROM Tasks");
        const timeLogs = await dbAllAsync("SELECT * FROM TimeLogs");
        const dailyScores = await dbAllAsync("SELECT * FROM DailyScores");
        const streakData = await dbAllAsync("SELECT * FROM StreakData");
        // Note: We are not exporting Settings as they are usually app-specific, not user data backups.
        // If you want to include them, add another query.

        const exportData = {
            habits,
            habitCompletions,
            tasks,
            timeLogs,
            dailyScores,
            streakData,
            exportedAt: new Date().toISOString()
        };

        // Set headers to prompt download
        res.setHeader('Content-Disposition', `attachment; filename="productivity_app_backup_${new Date().toISOString().slice(0, 10)}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(exportData);

    } catch (error) {
        console.error("Error exporting data:", error.message);
        res.status(500).json({ error: "Failed to export data." });
    }
});

const runDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)) });
});

app.post('/api/data/import', async (req, res) => {
    const importData = req.body;

    // Basic validation of the imported data structure
    const requiredTables = ['habits', 'habitCompletions', 'tasks', 'timeLogs', 'dailyScores', 'streakData'];
    for (const table of requiredTables) {
        if (!importData[table] || !Array.isArray(importData[table])) {
            return res.status(400).json({ error: `Invalid import data: Missing or invalid '${table}' array.` });
        }
    }

    // Use a transaction to ensure all or nothing
    try {
        await runDb("BEGIN TRANSACTION");

        // Clear existing data (order matters due to foreign key constraints if they were ON DELETE RESTRICT)
        // Our ON DELETE CASCADE for Habits->HabitCompletions helps, but clearing explicitly is safer.
        await runDb("DELETE FROM HabitCompletions");
        await runDb("DELETE FROM Habits"); // Habits must be deleted before completions if no cascade
        await runDb("DELETE FROM Tasks");
        await runDb("DELETE FROM TimeLogs");
        await runDb("DELETE FROM DailyScores");
        await runDb("DELETE FROM StreakData");
        // Reset auto-increment counters (SQLite specific)
        await runDb("DELETE FROM sqlite_sequence WHERE name IN ('Habits', 'HabitCompletions', 'Tasks', 'TimeLogs', 'DailyScores', 'StreakData')");


        // Insert imported data
        // Note: This assumes the imported data has IDs. If importing to a system that auto-generates IDs,
        // the ID field should be omitted from the INSERT statement and from the data objects.
        // For a backup/restore on the SAME system, keeping IDs is usually fine.

        for (const habit of importData.habits) {
            // Ensure all fields expected by the DB are present, or handle defaults
            await runDb("INSERT INTO Habits (id, name, current_weight, is_archived, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                [habit.id, habit.name, habit.current_weight, habit.is_archived, habit.created_at, habit.updated_at]);
        }
        for (const hc of importData.habitCompletions) {
            await runDb("INSERT INTO HabitCompletions (id, habit_id, completion_date, weight_at_completion, created_at) VALUES (?, ?, ?, ?, ?)",
                [hc.id, hc.habit_id, hc.completion_date, hc.weight_at_completion, hc.created_at]);
        }
        for (const task of importData.tasks) {
            await runDb("INSERT INTO Tasks (id, description, target_date, is_assigned, is_done, completion_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [task.id, task.description, task.target_date, task.is_assigned, task.is_done, task.completion_date, task.created_at, task.updated_at]);
        }
        for (const tl of importData.timeLogs) {
            await runDb("INSERT INTO TimeLogs (id, type, start_time, end_time, date_logged_for, duration_minutes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                [tl.id, tl.type, tl.start_time, tl.end_time, tl.date_logged_for, tl.duration_minutes, tl.created_at]);
        }
        for (const ds of importData.dailyScores) {
            await runDb("INSERT INTO DailyScores (id, date, habit_score_component, task_score_component, time_score_component, streak_bonus_component, total_daily_score, is_manually_marked_rest_day, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [ds.id, ds.date, ds.habit_score_component, ds.task_score_component, ds.time_score_component, ds.streak_bonus_component, ds.total_daily_score, ds.is_manually_marked_rest_day, ds.created_at, ds.updated_at]);
        }
        for (const sd of importData.streakData) {
            await runDb("INSERT INTO StreakData (id, date, current_streak_days, updated_at) VALUES (?, ?, ?, ?)",
                [sd.id, sd.date, sd.current_streak_days, sd.updated_at]);
        }

        await runDb("COMMIT");
        res.status(200).json({ message: "Data imported successfully." });

    } catch (error) {
        await runDb("ROLLBACK");
        console.error("Error importing data:", error.message);
        res.status(500).json({ error: `Failed to import data. ${error.message}` });
    }
});


app.put('/api/daily-notes/:date', async (req, res) => {
    const { date } = req.params;
    const { notes } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid or missing date parameter." });
    }
    if (typeof notes !== 'string') {
        return res.status(400).json({ error: "Missing or invalid 'notes' field in body (must be a string)." });
    }

    try {
        const runDb = (sql, params) => new Promise((resolve, reject) => { // Local promise wrapper
            db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)) });
        });

        const sql = `
            INSERT INTO DailyScores (date, notes) 
            VALUES (?, ?)
            ON CONFLICT(date) DO UPDATE SET 
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP;
        `;
        await runDb(sql, [date, notes]);

        res.json({ message: `Notes for ${date} saved successfully.` });

    } catch (error) {
        console.error(`Error saving notes for ${date}:`, error.message);
        res.status(500).json({ error: "Failed to save notes." });
    }
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Basic Error Handling for unhandled routes (optional)
app.use((req, res, next) => {
    res.status(404).json({ error: "Not Found" });
});

// Basic Global Error Handler (optional)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Something broke!" });
});
