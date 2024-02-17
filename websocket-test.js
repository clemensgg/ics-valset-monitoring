import WebSocket from 'ws';

const token = 'YOURTOKENHERE';
// Include the streamId in the URL path
const streamId = '0'; // Replace 'exampleStreamId' with your actual streamId
const ws = new WebSocket(`ws://172.19.0.3:3000/api/live/push/${streamId}/ws?token=${token}`);

ws.on('open', function open() {
  console.log('Connection is open');
  // Optionally, send a message or close the connection
  ws.send('something');
  // ws.close();
});

ws.on('message', function message(data) {
  console.log('Received:', data);
});

ws.on('error', function error(err) {
  console.log('Connection Error:', err.message);
});

ws.on('close', function close() {
  console.log('Connection Closed');
});
