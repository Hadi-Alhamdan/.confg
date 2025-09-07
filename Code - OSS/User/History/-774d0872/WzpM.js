// backend/routes/habits.js
const express = require('express');
const router = express.Router();
const { runDb, getDb, allDb } = require('../utils/dbUtils.js'); // Import from new util
const { recalculateDailyScore, recalculateStreaksForward } = require('../services/scoring.js');

// Helper function (can stay as is)
function getCurrentDateYYYYMMDD() {
    return new Date().toISOString().slice(0, 10);
}

// GET /api/habits - Fetch all active (non-archived) habits
router.get('/', async (req, res) => { // Add async
    const sql = "SELECT * FROM Habits WHERE is_archived = FALSE ORDER BY created_at DESC";
    try {
        const rows = await allDb(sql); // Use allDb
        res.json({ message: "success", data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/habits/archived - Fetch all archived habits
router.get('/archived', async (req, res) => { // Add async
    const sql = "SELECT * FROM Habits WHERE is_archived = TRUE ORDER BY created_at DESC";
    try {
        const rows = await allDb(sql); // Use allDb
        res.json({ message: "success", data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/habits/completions?date=YYYY-MM-DD - Get completions for a specific date
router.get('/completions', async (req, res) => { // Add async
    const { date } = req.query;
    if (!date) {
        return res.status(400).json({ error: "A 'date' query parameter is required." });
    }
    // Add date format validation if desired
    const sql = "SELECT * FROM HabitCompletions WHERE completion_date = ?";
    try {
        const rows = await allDb(sql, [date]); // Use allDb
        res.json({ message: "success", data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// POST /api/habits - Create a new habit
router.post('/', async (req, res) => { // Add async
    const { name, current_weight } = req.body;
    // ... (validation as before) ...
     if (!name || current_weight === undefined) {
         return res.status(400).json({ error: "Missing required fields: name and current_weight" });
     }
     if (typeof current_weight !== 'number' || current_weight < 0 || current_weight > 1) {
         return res.status(400).json({ error: "Invalid current_weight. Must be a number between 0 and 1." });
     }

    const sql = `INSERT INTO Habits (name, current_weight) VALUES (?, ?)`;
    const params = [name, parseFloat(current_weight)];
    try {
        const dbResult = await runDb(sql, params); // Use runDb
        res.status(201).json({
            message: "Habit created successfully",
            data: { id: dbResult.lastID, name, current_weight, is_archived: false }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/habits/:id - Update a habit
router.put('/:id', async (req, res) => { // Add async
    const { name, current_weight, is_archived } = req.body;
    const habitId = parseInt(req.params.id);
    // ... (validation and dynamic query building for fieldsToUpdate and params as before) ...
     if (isNaN(habitId)) return res.status(400).json({ error: "Invalid habit ID." });
     let fieldsToUpdate = [];
     let updateParams = []; // Use a different name for clarity

     if (name !== undefined) {
         fieldsToUpdate.push("name = ?");
         updateParams.push(name);
     }
     if (current_weight !== undefined) {
         if (typeof current_weight !== 'number' || current_weight < 0 || current_weight > 1) {
             return res.status(400).json({ error: "Invalid current_weight." });
         }
         fieldsToUpdate.push("current_weight = ?");
         updateParams.push(parseFloat(current_weight));
     }
     if (is_archived !== undefined) {
         if (typeof is_archived !== 'boolean') {
             return res.status(400).json({ error: "Invalid is_archived value." });
         }
         fieldsToUpdate.push("is_archived = ?");
         updateParams.push(is_archived);
     }
     if (fieldsToUpdate.length === 0) {
         return res.status(400).json({ error: "No fields provided for update." });
     }
     fieldsToUpdate.push("updated_at = CURRENT_TIMESTAMP");
     const sql = `UPDATE Habits SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
     updateParams.push(habitId);


    try {
        const dbResult = await runDb(sql, updateParams); // Use runDb and updateParams
        if (dbResult.changes === 0) {
            return res.status(404).json({ message: "Habit not found or no changes made." });
        }
        res.json({ message: `Habit ${habitId} updated successfully`, changes: dbResult.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/habits/:id - Delete a habit
router.delete('/:id', async (req, res) => { // Add async
    const habitId = parseInt(req.params.id);
    // ... (validation as before) ...
    if (isNaN(habitId)) return res.status(400).json({ error: "Invalid habit ID." });

    const sql = 'DELETE FROM Habits WHERE id = ?';
    try {
        const dbResult = await runDb(sql, [habitId]); // Use runDb
        if (dbResult.changes === 0) {
            return res.status(404).json({ message: "Habit not found." });
        }
        // TODO: If any completions for today were deleted due to ON DELETE CASCADE,
        // recalculateDailyScore(today) and potentially recalculateStreaksForward(today+1)
        res.json({ message: `Habit ${habitId} deleted successfully`, changes: dbResult.changes });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/habits/:id/complete - Mark a habit complete
router.post('/:id/complete', async (req, res) => {
    const habitId = parseInt(req.params.id);
    if (isNaN(habitId)) return res.status(400).json({ error: "Invalid habit ID." });
    
    const completionDate = (req.body && req.body.date) ? req.body.date : getCurrentDateYYYYMMDD();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(completionDate)) {
        return res.status(400).json({ error: "Invalid date format." });
    }

    try {
        const habit = await getDb("SELECT current_weight FROM Habits WHERE id = ?", [habitId]); // Use getDb
        if (!habit) {
            return res.status(404).json({ message: "Habit not found." });
        }
        const weightAtCompletion = habit.current_weight;
        const insertSql = `
            INSERT INTO HabitCompletions (habit_id, completion_date, weight_at_completion)
            VALUES (?, ?, ?)
            ON CONFLICT(habit_id, completion_date) DO UPDATE SET
                weight_at_completion = excluded.weight_at_completion,
                created_at = CURRENT_TIMESTAMP
        `;
        
        await runDb(insertSql, [habitId, completionDate, weightAtCompletion]); // Use runDb
        await recalculateDailyScore(completionDate);
        // No need for forward recalc here as completing a habit for one day
        // usually doesn't change past data in a way that breaks prior streaks,
        // only affects the current day's streak calculation.
        
        res.status(201).json({
            message: `Habit ${habitId} marked as complete for ${completionDate}`,
            data: { habit_id: habitId, completion_date: completionDate, weight_at_completion: weightAtCompletion }
        });
    } catch (err) {
        console.error(`Error completing habit ${habitId}:`, err.message);
        res.status(500).json({ error: "An error occurred while completing the habit." });
    }
});

// DELETE /api/habits/:id/complete?date=YYYY-MM-DD - Un-mark a habit completion
router.delete('/:id/complete', async (req, res) => {
    const habitId = parseInt(req.params.id);
    const { date } = req.query;
    // ... (validation as before) ...
     if (isNaN(habitId)) return res.status(400).json({ error: "Invalid habit ID." });
     if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
         return res.status(400).json({ error: "Missing or invalid 'date' query parameter." });
     }

    const sql = "DELETE FROM HabitCompletions WHERE habit_id = ? AND completion_date = ?";
    
    try {
        const dbResult = await runDb(sql, [habitId, date]); // Use runDb
        if (dbResult.changes === 0) {
            return res.status(404).json({ message: "Habit completion not found." });
        }

        await recalculateDailyScore(date);
        
        const dayAfterCompletionObj = new Date(Date.UTC(/* ... */)); // Correct date parsing
        dayAfterCompletionObj.setUTCDate(dayAfterCompletionObj.getUTCDate() + 1);
        const nextDayStr = dayAfterCompletionObj.toISOString().slice(0,10);
        
        console.log(`HABIT UNCOMPLETE: Triggering AWAITED recalculateStreaksForward from ${nextDayStr}`);
        await recalculateStreaksForward(nextDayStr);
        console.log(`HABIT UNCOMPLETE: AWAITED recalculateStreaksForward from ${nextDayStr} COMPLETED.`);

        res.json({ message: `Habit ${habitId} marked as not complete for ${date}.` });
    } catch (error) {
        console.error(`Error un-marking habit ${habitId} on ${date}:`, error.message);
        res.status(500).json({ error: "Failed to undo habit completion." });
    }
});

// GET /api/habits/:id/history - Get completion history for a specific habit
router.get('/:id/history', async (req, res) => { // Add async
    const habitId = parseInt(req.params.id);
    const { startDate, endDate } = req.query;
    // ... (validation as before) ...
     if (isNaN(habitId)) return res.status(400).json({ error: "Invalid habit ID." });
     // ... other validations for dates ...
     function getDatesInRange(start, end) { /* ... */ } // keep this helper
     const allDatesInRange = getDatesInRange(startDate, endDate);
     const sql = `SELECT completion_date, weight_at_completion FROM HabitCompletions WHERE habit_id = ? AND completion_date >= ? AND completion_date <= ? ORDER BY completion_date ASC`;

    try {
        const completionRows = await allDb(sql, [habitId, startDate, endDate]); // Use allDb
        const completionsMap = new Map();
        completionRows.forEach(row => {
            completionsMap.set(row.completion_date, row.weight_at_completion);
        });
        const chartData = allDatesInRange.map(dateStr => ({ /* ... */ }));
        res.json({ message: "success", data: chartData });
    } catch (error) {
        console.error(`Error fetching habit history for ${habitId}:`, error.message);
        res.status(500).json({ error: "Failed to fetch habit history." });
    }
});

module.exports = router;