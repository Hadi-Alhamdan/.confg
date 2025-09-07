// backend/routes/timelogs.js
const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { recalculateDailyScore } = require('../services/scoring.js');

// --- API Endpoints for TimeLogs ---

// GET /api/timelogs - Fetch time logs for a specific date
// Example: GET /api/timelogs?date=2023-11-21
router.get('/', (req, res) => {
    const { date } = req.query;

    if (!date) {
        return res.status(400).json({ error: "A 'date' query parameter is required." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD." });
    }

    const sql = "SELECT * FROM TimeLogs WHERE date_logged_for = ? ORDER BY start_time ASC";
    const params = [date];

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({
            message: "success",
            data: rows
        });
    });
});

// Replace the POST endpoint in backend/routes/timelogs.js

router.post('/', async (req, res) => { // Notice the 'async' here
    const { type, start_time, end_time } = req.body;

    // --- Validation (keep this part as is) ---
    if (!type || !start_time || !end_time) {
        return res.status(400).json({ error: "Missing required fields: type, start_time, end_time" });
    }
    // ... (all your other validation checks)
    const startTimeObj = new Date(start_time);
    const endTimeObj = new Date(end_time);

    if (startTimeObj >= endTimeObj) {
        return res.status(400).json({ error: "start_time must be before end_time." });
    }
    // ... (keep data preparation as is)
    const date_logged_for = startTimeObj.toISOString().slice(0, 10);
    const duration_minutes = Math.round((endTimeObj - startTimeObj) / (1000 * 60));

    // --- Database Insertion ---
    const sql = `INSERT INTO TimeLogs (type, start_time, end_time, date_logged_for, duration_minutes) 
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [type, start_time, end_time, date_logged_for, duration_minutes];
    
    // Use a Promise-based wrapper for db.run to use async/await
    const runDb = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this); // 'this' contains lastID and changes
        });
    });

    try {
        const dbResult = await runDb(sql, params);

        // Now that the log is saved, recalculate the score and AWAIT the result
        await recalculateDailyScore(date_logged_for);

        // ONLY after everything is done, send the final response
        res.status(201).json({
            message: "Time log created successfully",
            data: { id: dbResult.lastID, ...req.body, date_logged_for, duration_minutes }
        });

    } catch (err) {
        console.error("Error in POST /timelogs:", err.message);
        // If an error occurs at any point in the 'try' block, send one single error response
        res.status(500).json({ error: "An error occurred while logging time." });
    }
});

module.exports = router;