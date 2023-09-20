// src/db/db.js

import sqlite3 from 'sqlite3';

const db = new sqlite3.verbose().Database('./icsValsetMonitoring.db');

db.serialize(() => {
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS consensusState (
        chainId TEXT,
        height INTEGER,
        timestamp TEXT,
        validators TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS consensusValidators (
        chainId TEXT,
        height INTEGER,
        validators TEXT
    )`);
});

export default db;
