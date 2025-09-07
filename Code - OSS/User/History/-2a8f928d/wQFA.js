// backend/db.js (or database.js)

const sqlite3 = require('sqlite3').verbose();

// Create or open the database file
const DB_SOURCE = "productivity_app.db";

const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

function createTables() {
    // Use db.serialize to ensure statements run in order if needed,
    // though for CREATE TABLE IF NOT EXISTS, db.exec or multiple db.run is fine.
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS Habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                current_weight REAL NOT NULL CHECK(current_weight >= 0 AND current_weight <= 1),
                is_archived BOOLEAN DEFAULT FALSE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS update_habits_updated_at
            AFTER UPDATE ON Habits FOR EACH ROW
            BEGIN
                UPDATE Habits SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS HabitCompletions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER NOT NULL,
                completion_date TEXT NOT NULL, -- YYYY-MM-DD
                weight_at_completion REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (habit_id) REFERENCES Habits(id) ON DELETE CASCADE,
                UNIQUE(habit_id, completion_date)
            );
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS Tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL,
                target_date TEXT NOT NULL, -- YYYY-MM-DD
                is_assigned BOOLEAN DEFAULT TRUE,
                is_done BOOLEAN DEFAULT FALSE,
                completion_date TEXT, -- YYYY-MM-DD
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS update_tasks_updated_at
            AFTER UPDATE ON Tasks FOR EACH ROW
            BEGIN
                UPDATE Tasks SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS TimeLogs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('productive', 'distracting')),
                start_time DATETIME NOT NULL,
                end_time DATETIME NOT NULL,
                date_logged_for TEXT NOT NULL, -- YYYY-MM-DD
                duration_minutes INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS DailyScores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE,
                habit_score_component REAL DEFAULT 0,
                task_score_component REAL DEFAULT 0,
                time_score_component REAL DEFAULT 0,
                streak_bonus_component REAL DEFAULT 0,
                total_daily_score REAL DEFAULT 0,
                is_manually_marked_rest_day BOOLEAN DEFAULT FALSE,
                notes TEXT DEFAULT '', 
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS update_dailyscores_updated_at
            AFTER UPDATE ON DailyScores FOR EACH ROW
            BEGIN
                UPDATE DailyScores SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS StreakData (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
                current_streak_days INTEGER DEFAULT 0,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`
            CREATE TRIGGER IF NOT EXISTS update_streakdata_updated_at
            AFTER UPDATE ON StreakData FOR EACH ROW
            BEGIN
                UPDATE StreakData SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
            END;
        `);

        // --- SETTINGS TABLE AND ITS TRIGGER ARE REMOVED ---

        console.log("Tables creation process finished (tables created or already exist).");
    });
}

module.exports = db;