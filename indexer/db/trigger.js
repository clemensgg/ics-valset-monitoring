import pkg from 'pg';
import fs from 'fs';
import WebSocket from 'ws';
//import { runDatabaseQuery } from './db.js';
let client;

const createClient = () => {
    return new pkg.Client({
        host: CONFIG.pg.host,
        port: CONFIG.pg.port,
        user: CONFIG.pg.user,
        password: CONFIG.pg.password,
        database: CONFIG.pg.database,
        statement_timeout: CONFIG.pg.statement_timeout_ms
    });
};

const initializeTriggerClient = async () => {
    client = createClient();
    await client.connect()
        .then(() => {
            console.log('Connected to PostgreSQL database.');
            return client.query('SET CONSTRAINTS ALL IMMEDIATE;');
        })
        .catch(err => {
            console.error('Database connection failed on trigger:', err);
            process.exit(1);
        });
    client.query('LISTEN data_change_channel');

    // Listen for notifications from PostgreSQL
    client.on('notification', async (msg) => {
        const payload = JSON.parse(msg.payload);
        console.log('Received Consensus notification:', payload);
    });
};

const updatePreVote = async (roundNumber) => {
    const query = `
    INSERT INTO "PreVote" ("roundNumber")
    VALUES ($1);
`;
    try {
        await runDatabaseQuery(query, [roundNumber], 'run');
        console.log(`Updated PreVote for Round ${roundNumber}`);
    } catch (err) {
        console.error('Error updating PreVote:', err);
        throw err;
    }
};



export {
    initializeTriggerClient,
    //updatePreVote
}
