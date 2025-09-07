// backend/routes/habits.js
const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { recalculateDailyScore } = require('../services/scoring.js');

// --- Helper function to get current date in YYYY-MM-DD format ---
function getCurrentDateYYYYMMDD() {
    return new Date().toISOString().slice(0, 10);
}

// --- API Endpoints for Habits ---

// GET /api/habits - Fetch all active (non-archived) habits
router.get('/', (req, res) => {
    const sql = "SELECT * FROM Habits WHERE is_archived = FALSE ORDER BY created_at DESC";
    db.all(sql, [], (err, rows) => {
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

// GET /api/habits/archived - Fetch all archived habits
router.get('/archived', (req, res) => {
    const sql = "SELECT * FROM Habits WHERE is_archived = TRUE ORDER BY created_at DESC";
    db.all(sql, [], (err, rows) => {
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

// POST /api/habits - Create a new habit
router.post('/', (req, res) => {
    const { name, current_weight } = req.body;
    if (!name || current_weight === undefined) {
        return res.status(400).json({ error: "Missing required fields: name and current_weight" });
    }
    if (typeof current_weight !== 'number' || current_weight < 0 || current_weight > 1) {
        return res.status(400).json({ error: "Invalid current_weight. Must be a number between 0 and 1." });
    }

    const sql = `INSERT INTO Habits (name, current_weight) VALUES (?, ?)`;
    const params = [name, parseFloat(current_weight)];
    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({
            message: "Habit created successfully",
            data: { id: this.lastID, name, current_weight, is_archived: false }
        });
    });
});

// PUT /api/habits/:id - Update a habit (name, weight, archive status)
router.put('/:id', (req, res) => {
    const { name, current_weight, is_archived } = req.body;
    const habitId = parseInt(req.params.id);

    if (isNaN(habitId)) {
        return res.status(400).json({ error: "Invalid habit ID." });
    }

    // Build the update query dynamically based on provided fields
    let fieldsToUpdate = [];
    let params = [];

    if (name !== undefined) {
        fieldsToUpdate.push("name = ?");
        params.push(name);
    }
    if (current_weight !== undefined) {
        if (typeof current_weight !== 'number' || current_weight < 0 || current_weight > 1) {
            return res.status(400).json({ error: "Invalid current_weight. Must be a number between 0 and 1." });
        }
        fieldsToUpdate.push("current_weight = ?");
        params.push(parseFloat(current_weight));
    }
    if (is_archived !== undefined) {
        if (typeof is_archived !== 'boolean') {
            return res.status(400).json({ error: "Invalid is_archived value. Must be true or false." });
        }
        fieldsToUpdate.push("is_archived = ?");
        params.push(is_archived);
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: "No fields provided for update." });
    }

    fieldsToUpdate.push("updated_at = CURRENT_TIMESTAMP"); // Ensure updated_at is set

    const sql = `UPDATE Habits SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    params.push(habitId);

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Habit not found or no changes made." });
        }
        res.json({
            message: `Habit ${habitId} updated successfully`,
            changes: this.changes
        });
    });
});

// DELETE /api/habits/:id - Delete a habit
// For now, this is a hard delete. Consider soft delete (marking as deleted) if you want to keep history.
// If you hard delete, ON DELETE CASCADE in HabitCompletions will remove related completions.
router.delete('/:id', (req, res) => {
    const habitId = parseInt(req.params.id);
    if (isNaN(habitId)) {
        return res.status(400).json({ error: "Invalid habit ID." });
    }

    const sql = 'DELETE FROM Habits WHERE id = ?';
    db.run(sql, [habitId], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Habit not found." });
        }
        res.json({ message: `Habit ${habitId} deleted successfully`, changes: this.changes });
    });
});


// POST /api/habits/:id/complete - Mark a habit complete for a given date
// Expects { "date": "YYYY-MM-DD" } in the body. If no date, defaults to today.
// Replace POST /:id/complete in habits.js

// Replace POST /:id/complete in habits.js with this full version

router.post('/:id/complete', async (req, res) => { // Add async
    const habitId = parseInt(req.params.id);
    if (isNaN(habitId)) {
        return res.status(400).json({ error: "Invalid habit ID." });
    }

    const completionDate = (req.body && req.body.date) ? req.body.date : new Date().toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
        return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD." });
    }

    // Promise-based DB wrappers
    const getDb = (sql, params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
    const runDb = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)) });
    });

    try {
        const habit = await getDb("SELECT current_weight FROM Habits WHERE id = ?", [habitId]);
        if (!habit) {
            return res.status(404).json({ message: "Habit not found." });
        }
        const weightAtCompletion = habit.current_weight;

        // --- THIS IS THE CORRECTED SQL ---
        const insertSql = `
            INSERT INTO HabitCompletions (habit_id, completion_date, weight_at_completion)
            VALUES (?, ?, ?)
            ON CONFLICT(habit_id, completion_date) DO UPDATE SET
                weight_at_completion = excluded.weight_at_completion,
                created_at = CURRENT_TIMESTAMP
        `;

        await runDb(insertSql, [habitId, completionDate, weightAtCompletion]);
        await recalculateDailyScore(completionDate);

        res.status(201).json({
            message: `Habit ${habitId} marked as complete for ${completionDate}`,
            data: { habit_id: habitId, completion_date: completionDate, weight_at_completion: weightAtCompletion }
        });
    } catch (err) {
        console.error("Error completing habit:", err.message);
        res.status(500).json({ error: "An error occurred while completing the habit." });
    }
});

// GET /api/habits/:id/completions - Get completions for a specific habit (e.g., for charting)
// Optional query params: startDate, endDate (YYYY-MM-DD)
router.get('/completions', (req, res) => {
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: "A 'date' query parameter is required." });
    }
    const sql = "SELECT * FROM HabitCompletions WHERE completion_date = ?";
    db.all(sql, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "success", data: rows });
    });
});


const dbAllAsync = (sqlQuery, params = []) => new Promise((resolve, reject) => {
    db.all(sqlQuery, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});


// GET /api/habits/:id/history - Get completion history for a specific habit
// Query params: startDate (YYYY-MM-DD), endDate (YYYY-MM-DD)
router.get('/:id/history', async (req, res) => {
    const habitId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;

    if (isNaN(habitId)) {
        return res.status(400).json({ error: "Invalid habit ID." });
    }
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

    // Fetch completions for this habit within the date range
    const sql = `
        SELECT completion_date, weight_at_completion 
        FROM HabitCompletions 
        WHERE habit_id = ? AND completion_date >= ? AND completion_date <= ?
        ORDER BY completion_date ASC
    `;

    try {
        const completionRows = await dbAllAsync(sql, [habitId, startDate, endDate]);

        // Create a map for quick lookup of completions
        const completionsMap = new Map();
        completionRows.forEach(row => {
            completionsMap.set(row.completion_date, row.weight_at_completion);
        });

        // Construct the final data
        const chartData = allDatesInRange.map(dateStr => ({
            date: dateStr,
            completed: completionsMap.has(dateStr),
            weight_at_completion: completionsMap.get(dateStr) || null
        }));

        res.json({ message: "success", data: chartData });

    } catch (error) {
        console.error(`Error fetching habit history for habit ${habitId}:`, error.message);
        res.status(500).json({ error: "Failed to fetch habit history." });
    }
});



// DELETE /api/habits/:id/complete?date=YYYY-MM-DD - Un-mark a habit completion for a specific date
router.delete('/:id/complete', async (req, res) => { // Note: Using DELETE method
    const habitId = parseInt(req.params.id);
    const { date } = req.query; // Get date from query parameter

    if (isNaN(habitId)) {
        return res.status(400).json({ error: "Invalid habit ID." });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: "Missing or invalid 'date' query parameter. Use YYYY-MM-DD format." });
    }

    const sql = "DELETE FROM HabitCompletions WHERE habit_id = ? AND completion_date = ?";
    
    try {
        const dbResult = await runDb(sql, [habitId, date]);

        if (dbResult.changes === 0) {
            return res.status(404).json({ message: "Habit completion not found for this date or already undone." });
        }

        // After deleting the completion, recalculate the score for that date
        await recalculateDailyScore(date);
        // If this change could affect future streaks (e.g., score drops below threshold)
        // then a forward recalc might be needed, starting from date + 1.
        const dayAfterCompletionObj = new Date(Date.UTC(
            parseInt(date.substring(0,4)),
            parseInt(date.substring(5,7)) - 1,
            parseInt(date.substring(8,10))
        ));
        dayAfterCompletionObj.setUTCDate(dayAfterCompletionObj.getUTCDate() + 1);
        const nextDayStr = dayAfterCompletionObj.toISOString().slice(0,10);
        
        // For consistency, await it during testing.
        // In production, you might run this in the background if it's too slow.
        console.log(`HABIT UNCOMPLETE: Triggering AWAITED recalculateStreaksForward from ${nextDayStr}`);
        await recalculateStreaksForward(nextDayStr);
        console.log(`HABIT UNCOMPLETE: AWAITED recalculateStreaksForward from ${nextDayStr} COMPLETED.`);


        res.json({ message: `Habit ${habitId} marked as not complete for ${date}.` });

    } catch (error) {
        console.error(`Error un-marking habit completion for habit ${habitId} on ${date}:`, error.message);
        res.status(500).json({ error: "Failed to undo habit completion." });
    }
});

module.exports = router;