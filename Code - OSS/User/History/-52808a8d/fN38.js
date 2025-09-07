// backend/routes/tasks.js
const express = require('express');
const router = express.Router();
const db = require('../db.js');
const { recalculateDailyScore, recalculateStreaksForward } = require('../services/scoring.js');
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




router.put('/:id', async (req, res) => {
    const taskId = parseInt(req.params.id);
    const { description, target_date, is_assigned, is_done } = req.body;

    if (isNaN(taskId)) {
        return res.status(400).json({ error: "Invalid task ID." });
    }

    let fieldsToUpdate = [];
    let paramsForUpdate = []; // Use a different name to avoid conflict with the 'params' in db calls

    if (description !== undefined) {
        fieldsToUpdate.push("description = ?");
        paramsForUpdate.push(description);
    }
    if (target_date !== undefined) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
            return res.status(400).json({ error: "Invalid target_date format." });
        }
        fieldsToUpdate.push("target_date = ?");
        paramsForUpdate.push(target_date);
    }
    if (is_assigned !== undefined) {
        if (typeof is_assigned !== 'boolean') {
            return res.status(400).json({ error: "Invalid is_assigned value." });
        }
        fieldsToUpdate.push("is_assigned = ?");
        paramsForUpdate.push(is_assigned);
    }
    if (is_done !== undefined) {
        if (typeof is_done !== 'boolean') {
            return res.status(400).json({ error: "Invalid is_done value." });
        }
        fieldsToUpdate.push("is_done = ?");
        paramsForUpdate.push(is_done);

        const completionDate = is_done ? new Date().toISOString().slice(0, 10) : null;
        fieldsToUpdate.push("completion_date = ?");
        paramsForUpdate.push(completionDate);
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ error: "No fields provided for update." });
    }

    // --- THIS IS WHERE 'sqlQuery' and 'finalParams' ARE DEFINED ---
    const sqlQuery = `UPDATE Tasks SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    const finalParams = [...paramsForUpdate, taskId]; // Add taskId to the end of parameters for the WHERE clause

    // Promise-based DB wrappers
    const runDb = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function (err) { (err ? reject(err) : resolve(this)) });
    });
    const getDb = (sql, params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });


    try {
        const dbResult = await runDb(sqlQuery, finalParams);
        if (dbResult.changes === 0) {
            return res.status(404).json({ message: "Task not found or no changes made." });
        }

        const task = await getDb('SELECT target_date FROM Tasks WHERE id = ?', [taskId]);
        if (task) {
            const taskDate = task.target_date;
            console.log(`TASK UPDATE: Recalculating score for taskDate: ${taskDate}`);
            await recalculateDailyScore(taskDate);
            console.log(`TASK UPDATE: Finished recalculating score for taskDate: ${taskDate}`);

            // Calculate next day string
            const dayAfterTaskDateObj = new Date(Date.UTC(
                parseInt(taskDate.substring(0, 4)),
                parseInt(taskDate.substring(5, 7)) - 1,
                parseInt(taskDate.substring(8, 10))
            ));
            dayAfterTaskDateObj.setUTCDate(dayAfterTaskDateObj.getUTCDate() + 1);
            const nextDayStr = dayAfterTaskDateObj.toISOString().slice(0, 10);

            // Call recalculateStreaksForward (awaited for testing)
            try {
                console.log(`TASK UPDATE: Triggering AWAITED recalculateStreaksForward from ${nextDayStr}`);
                await recalculateStreaksForward(nextDayStr);
                console.log(`TASK UPDATE: AWAITED recalculateStreaksForward from ${nextDayStr} COMPLETED.`);
            } catch (forwardRecalcError) {
                console.error(`Error during AWAITED forward streak recalc triggered by task update: ${forwardRecalcError.message}`);
                // Don't let this error stop the main response, but log it.
            }
        }

        res.json({ message: `Task ${taskId} updated successfully`, changes: dbResult.changes });

    } catch (err) {
        console.error("Error updating task:", err.message);
        res.status(500).json({ error: "An error occurred while updating the task." });
    }
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