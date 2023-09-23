// src/server.js

import express from 'express';

import db from '../indexer/db/db.js';

const app = express();
const PORT = 3000;

app.get('/consensusState',
  (req, res) => {
    db.all('SELECT * FROM consensusState',
      [],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      });
  });

app.get('/consensusValidators',
  (req, res) => {
    db.all('SELECT * FROM consensusValidators',
      [],
      (err, rows) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(rows);
      });
  });

app.listen(PORT,
  () => {
    console.log(`Server is running on port ${PORT}`);
  });

export default app;
