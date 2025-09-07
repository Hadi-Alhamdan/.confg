const express = require('express');
const db = require('./db.js');  // Your database setup
const cors = require('cors'); // For allowing Cross-Origin Resource Sharing

const habitRoutes = require('./routes/habits.js');
const taskRoutes = require('./routes/tasks.js'); 
const timeLogRoutes = require('./routes/timelogs.js'); 
const { recalculateDailyScore } = require('./services/scoring.js');
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

// Placeholder Routes (we'll implement these fully later)
// You can create separate route files for these (e.g., routes/habits.js)

// Example: Basic /api/settings endpoints
app.get('/api/settings', (req, res) => {
    const sql = "SELECT * FROM Settings WHERE id = 1"; // Assuming single user settings
    db.get(sql, [], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) { // Should not happen if initialized correctly
            return res.status(404).json({ message: "Settings not found. Initialize them."});
        }
        res.json({
            message: "success",
            data: row
        });
    });
});

app.put('/api/settings', (req, res) => {
    // ... (keep existing settings PUT logic)
    const {
        rest_day_monday, rest_day_tuesday, rest_day_wednesday,
        rest_day_thursday, rest_day_friday, rest_day_saturday, rest_day_sunday
    } = req.body;

    const booleanFields = [
        rest_day_monday, rest_day_tuesday, rest_day_wednesday,
        rest_day_thursday, rest_day_friday, rest_day_saturday, rest_day_sunday
    ];

    if (booleanFields.some(field => typeof field !== 'boolean' && field !== undefined)) {
        return res.status(400).json({ error: "Invalid data types for rest days. Must be boolean." });
    }

    const sql = `UPDATE Settings SET
        rest_day_monday = ?,
        rest_day_tuesday = ?,
        rest_day_wednesday = ?,
        rest_day_thursday = ?,
        rest_day_friday = ?,
        rest_day_saturday = ?,
        rest_day_sunday = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = 1`; // Assuming single user settings

    const params = [
        rest_day_monday, rest_day_tuesday, rest_day_wednesday,
        rest_day_thursday, rest_day_friday, rest_day_saturday, rest_day_sunday
    ];

    db.run(sql, params, function (err) { // Use function() to access this.changes
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: "Settings not found (should not happen)." });
        }
        res.json({
            message: "Settings updated successfully",
            changes: this.changes
        });
    });
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