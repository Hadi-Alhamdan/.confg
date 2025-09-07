const sqlite3 = require('sqlite3').verbose();

// Create or open the database file
const DB_SOURCE = "productivity_app.db"; // This file will be created in the 'backend' directory

const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    const tablesSQL = `
        CREATE TABLE IF NOT EXISTS Habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            current_weight REAL NOT NULL CHECK(current_weight >= 0 AND current_weight <= 1),
            is_archived BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS HabitCompletions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            habit_id INTEGER NOT NULL,
            completion_date TEXT NOT NULL, -- YYYY-MM-DD
            weight_at_completion REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (habit_id) REFERENCES Habits(id) ON DELETE CASCADE,
            UNIQUE(habit_id, completion_date) -- A habit can only be completed once per day
        );

        CREATE TABLE IF NOT EXISTS Tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            target_date TEXT NOT NULL, -- YYYY-MM-DD: The date this task is for
            is_assigned BOOLEAN DEFAULT TRUE,
            is_done BOOLEAN DEFAULT FALSE,
            completion_date TEXT, -- YYYY-MM-DD: Actual date of completion
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS TimeLogs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL CHECK(type IN ('productive', 'distracting')), -- 'productive' or 'distracting'
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            date_logged_for TEXT NOT NULL, -- YYYY-MM-DD: The day this time log applies to
            duration_minutes INTEGER, -- Calculated, can be useful
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS DailyScores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
            habit_score_component REAL DEFAULT 0,
            task_score_component REAL DEFAULT 0,
            time_score_component REAL DEFAULT 0,
            streak_bonus_component REAL DEFAULT 0,
            total_daily_score REAL DEFAULT 0,
            is_manually_marked_rest_day BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS StreakData ( -- Or could be part of UserSettings or a UserProfile table later
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Only one row needed for a single-user app, or use date as PK
            date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD for which this streak count is valid
            current_streak_days INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            -- last_streak_increment_date TEXT -- Could be useful
        );

        CREATE TABLE IF NOT EXISTS Settings (
            id INTEGER PRIMARY KEY DEFAULT 1, -- Only one row for settings in a single-user app
            rest_day_monday BOOLEAN DEFAULT FALSE,
            rest_day_tuesday BOOLEAN DEFAULT FALSE,
            rest_day_wednesday BOOLEAN DEFAULT FALSE,
            rest_day_thursday BOOLEAN DEFAULT FALSE,
            rest_day_friday BOOLEAN DEFAULT FALSE,
            rest_day_saturday BOOLEAN DEFAULT FALSE,
            rest_day_sunday BOOLEAN DEFAULT FALSE,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Triggers to update 'updated_at' timestamps (SQLite specific)
        CREATE TRIGGER IF NOT EXISTS update_habits_updated_at
        AFTER UPDATE ON Habits
        FOR EACH ROW
        BEGIN
            UPDATE Habits SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at
        AFTER UPDATE ON Tasks
        FOR EACH ROW
        BEGIN
            UPDATE Tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_dailyscores_updated_at
        AFTER UPDATE ON DailyScores
        FOR EACH ROW
        BEGIN
            UPDATE DailyScores SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_streakdata_updated_at
        AFTER UPDATE ON StreakData
        FOR EACH ROW
        BEGIN
            UPDATE StreakData SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;

        CREATE TRIGGER IF NOT EXISTS update_settings_updated_at
        AFTER UPDATE ON Settings
        FOR EACH ROW
        BEGIN
            UPDATE Settings SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;
    `;

    db.exec(tablesSQL, (err) => {
        if (err) {
            console.error("Error creating tables:", err.message);
        } else {
            console.log("Tables created or already exist.");
            // Initialize settings if not present
            db.run(`INSERT OR IGNORE INTO Settings (id) VALUES (1)`, (err) => {
                if (err) console.error("Error initializing settings:", err.message);
                else console.log("Settings initialized if they didn't exist.");
            });
        }
    });
}

module.exports = db; // Export the database connection