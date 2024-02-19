import pkg from 'pg';
import fs from 'fs';
import WebSocket from 'ws';
import { createNewGrafanaApiToken } from './middleware.js';
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
      console.error('Database connection failed:', err);
      process.exit(1);
    });
  client.query('LISTEN data_change_channel');
  
  const apiKey = await createNewGrafanaApiToken();

  // WebSocket connection to Grafana Live
  const ws = new WebSocket('ws://127.0.0.1:3001/api/live/push/ws', {
  headers: {
      'Authorization': 'Bearer ' + apiKey
    }
  });


  ws.on('open', function open() {
    console.log('Connected to Grafana Live');

    // Listen for notifications from PostgreSQL
    client.on('notification', async (msg) => {
      const payload = JSON.parse(msg.payload);
      console.log('Received Consensus notification:', payload);
      
      // Write the JSON payload to a file
      fs.writeFile('payload.json', JSON.stringify(payload, null, 2), (err) => {
        if (err) {
          console.error('Error writing to file:', err);
        } else {
          console.log('Payload saved to payload.json');
        }
      });

      // Push the data to Grafana Live
      ws.send(JSON.stringify({
        stream: 'your_stream',
        data: payload
      }));
    });
  });

  ws.on('error', function error(err) {
    console.log('WebSocket Error:', err);
  });

  ws.on('message', function incoming(data) {
    const response = JSON.parse(data);
        console.log('Acknowledgement received for message');
});

  
  // Handle WebSocket closures
  ws.on('close', function close() {
    console.log('Disconnected from Grafana Live');
    // Reconnect or handle closure
  });
};

export {
    initializeTriggerClient
}