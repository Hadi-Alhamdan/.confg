// backend/routes/tasks.js
const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { recalculateDailyScore } = require('../services/scoring.js');
// --- Helper function to get current date in YYYY-MM-DD format ---
function getCurrentDateYYYYMMDD() {
    return new Date().toISOString().slice(0, 10);
}

// --- API Endpoints for Tasks ---

// GET /api/tasks - Fetch tasks, optionally filtered by date
// Example: GET /api/tasks?date=2023-11-21
router.get('/', (req, res) => {
    const { date } = req.query;

    let sql = "SELECT * FROM Tasks";
    const params = [];

    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: "Invalid date format. Please use YYYY-MM-DD." });
        }
        sql += " WHERE target_date = ?";
        params.push(date);
    }
    
    sql += " ORDER BY target_date, created_at DESC";

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

// POST /api/tasks - Create a new task
router.post('/', (req, res) => {
    const { description, target_date, is_assigned = true } = req.body; // Default is_assigned to true

    // Validation
    if (!description || !target_date) {
        return res.status(400).json({ error: "Missing required fields: description and target_date" });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
        return res.status(400).json({ error: "Invalid target_date format. Please use YYYY-MM-DD." });
    }
    if (typeof is_assigned !== 'boolean') {
        return res.status(400).json({ error: "Invalid is_assigned value. Must be true or false." });
    }

    const sql = `INSERT INTO Tasks (description, target_date, is_assigned) VALUES (?, ?, ?)`;
    const params = [description, target_date, is_assigned];

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({
            message: "Task created successfully",
            data: { 
                id: this.lastID,
                description,
                target_date,
                is_assigned,
                is_done: false,
                completion_date: null
            }
        });
    });
});

// PUT /api/tasks/:id - Update a task (description, date, status)
router.put('/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    const { description, target_date, is_assigned, is_done } = req.body;

    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID." });
    }

    // Build the update query dynamically
    let fieldsToUpdate = [];
    let params = [];

    if (description !== undefined) {
        fieldsToUpdate.push("description = ?");
        params.push(description);
    }
    if (target_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
            return res.status(400).json({ error: "Invalid target_date format." });
        }
        fieldsToUpdate.push("target_date = ?");
        params.push(target_date);
    }
    if (is_assigned !== undefined) {
        if (typeof is_assigned !== 'boolean') {
            return res.status(400).json({ error: "Invalid is_assigned value." });
        }
        fieldsToUpdate.push("is_assigned = ?");
        params.push(is_assigned);
    }
    if (is_done !== undefined) {
        if (typeof is_done !== 'boolean') {
            return res.status(400).json({ error: "Invalid is_done value." });
        }
        fieldsToUpdate.push("is_done = ?");
        params.push(is_done);
        
        // When marking a task as done, set completion_date. When undoing, clear it.
        fieldsToUpdate.push("completion_date = ?");
        params.push(is_done ? getCurrentDateYYYYMMDD() : null);

        // TODO LATER: When is_done status changes, trigger recalculateDailyScore(target_date)
        // And potentially recalculateDailyScore for the old date if target_date also changed.
        console.log(`Task ${taskId} done status changed for target_date ${target_date}. Daily score recalculation pending.`);
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: "No fields provided for update." });
    }

    const sql = `UPDATE Tasks SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    params.push(taskId);

    db.run(sql, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Task not found or no changes made." });
        }
        res.json({
            message: `Task ${taskId} updated successfully`,
            changes: this.changes
        });
    });
});

// DELETE /api/tasks/:id - Delete a task
router.delete('/:id', (req, res) => {
    const taskId = parseInt(req.params.id);
    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID." });
    }

    const sql = 'DELETE FROM Tasks WHERE id = ?';
    db.run(sql, [taskId], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Task not found." });
        }
        
        // TODO LATER: Trigger score recalculation for the deleted task's target_date.
        
        res.json({ message: `Task ${taskId} deleted successfully`, changes: this.changes });
    });
});

module.exports = router;