// backend/utils/dbUtils.js
const db = require('../db.js'); // Or ../database.js - path to your SQLite connection file

const runDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this); // 'this' contains lastID and changes for INSERT/UPDATE/DELETE
    });
});

const getDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row); // Resolves with a single row or undefined
    });
});

const allDb = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows); // Resolves with an array of rows
    });
});

module.exports = { runDb, getDb, allDb };