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

router.post('/:id/complete', async (req, res) => { // Add async
    const habitId = parseInt(req.params.id);
    const completionDate = (req.body && req.body.date) ? req.body.date : new Date().toISOString().slice(0, 10);
    // ... (validation checks)

    const getDb = (sql, params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
    const runDb = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) { (err ? reject(err) : resolve(this)) });
    });

    try {
        const habit = await getDb("SELECT current_weight FROM Habits WHERE id = ?", [habitId]);
        if (!habit) {
            return res.status(404).json({ message: "Habit not found." });
        }
        const weightAtCompletion = habit.current_weight;
        const insertSql = `INSERT ...`; // Your existing insert SQL
        
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
router.get('/:id/completions', (req, res) => {
    const habitId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;

    if (isNaN(habitId)) {
        return res.status(400).json({ error: "Invalid habit ID." });
    }

    let sql = "SELECT * FROM HabitCompletions WHERE habit_id = ?";
    const params = [habitId];

    if (startDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return res.status(400).json({ error: "Invalid startDate format."});
        sql += " AND completion_date >= ?";
        params.push(startDate);
    }
    if (endDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return res.status(400).json({ error: "Invalid endDate format."});
        sql += " AND completion_date <= ?";
        params.push(endDate);
    }
    sql += " ORDER BY completion_date ASC";

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


module.exports = router;