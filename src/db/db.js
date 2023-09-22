// src/db/db.js

import sqlite3 from 'sqlite3'

const sqlite = sqlite3.verbose()
const db = new sqlite.Database('./icsValsetMonitoring.db', (err) => {
  if (err) {
    console.error(err.message)
  }
  console.log('Connected to the ics-valset-monitoring database.')
})

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS stakingValidators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT
    )`)

  db.run(`CREATE TABLE IF NOT EXISTS matchedValidators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stakingValidator TEXT,
        consensusValidator TEXT
    )`)

  db.run(`CREATE TABLE IF NOT EXISTS consumerChainInfos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT
    )`)

  db.run(`CREATE TABLE IF NOT EXISTS providerChainInfos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        data TEXT
    )`)
})

export default db
