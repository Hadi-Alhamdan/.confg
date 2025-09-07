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

// POST /api/timelogs - Log a new block of time
router.post('/', (req, res) => {
    const { type, start_time, end_time } = req.body;

    // --- Validation ---
    if (!type || !start_time || !end_time) {
        return res.status(400).json({ error: "Missing required fields: type, start_time, end_time" });
    }
    if (type !== 'productive' && type !== 'distracting') {
        return res.status(400).json({ error: "Invalid type. Must be 'productive' or 'distracting'." });
    }
    // Basic ISO 8601 datetime format validation
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
    if (!dateTimeRegex.test(start_time) || !dateTimeRegex.test(end_time)) {
        return res.status(400).json({ error: "Invalid datetime format. Please use ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SSZ)." });
    }

    const startTimeObj = new Date(start_time);
    const endTimeObj = new Date(end_time);

    if (startTimeObj >= endTimeObj) {
        return res.status(400).json({ error: "start_time must be before end_time." });
    }

    // --- Data Preparation ---
    // The date the log applies to is determined by the start_time
    const date_logged_for = startTimeObj.toISOString().slice(0, 10);
    // Calculate duration in minutes
    const duration_minutes = Math.round((endTimeObj - startTimeObj) / (1000 * 60));

    // --- Database Insertion ---
    const sql = `INSERT INTO TimeLogs (type, start_time, end_time, date_logged_for, duration_minutes) 
                 VALUES (?, ?, ?, ?, ?)`;
    const params = [type, start_time, end_time, date_logged_for, duration_minutes];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        db.run(sql, params, function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            // Trigger score recalculation
            recalculateDailyScore(date_logged_for).catch(err => {
                console.error(`Failed to recalculate score after time log: ${err.message}`);
            });

            res.status(201).json({
                message: "Time log created successfully",
                data: { id: this.lastID, ...req.body, date_logged_for, duration_minutes }
            });
        });
        console.log(`Time log created for ${date_logged_for}. Daily score recalculation pending.`);

        res.status(201).json({
            message: "Time log created successfully",
            data: { id: this.lastID, ...req.body, date_logged_for, duration_minutes }
        });
    });
});

module.exports = router;