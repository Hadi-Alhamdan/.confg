const express = require('express');
const db = require('./db.js');  // Your database setup
const cors = require('cors'); // For allowing Cross-Origin Resource Sharing

const habitRoutes = require('./routes/habits.js');
const taskRoutes = require('./routes/tasks.js'); 
const timeLogRoutes = require('./routes/timelogs.js'); 
const app = express();
const PORT = process.env.PORT || 3000; // Use environment port or default to 3000

// Middleware
app.use(cors()); // Allow all origins for now (can be configured more strictly)
app.use(express.json()); // To parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // To parse URL-encoded request bodies
app.use('/api/habits', habitRoutes);
app.use('/api/tasks', taskRoutes);

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