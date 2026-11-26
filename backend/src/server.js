const http = require('http');
const app = require('./app');
const config = require('./config');
const { connectDb } = require('./config/db');
const { initSockets } = require('./services/socketService');

const server = http.createServer(app);
initSockets(server);

async function start() {
  await connectDb(config.mongoUri);
  server.listen(config.port, () => {
    console.log(`[server] listening on :${config.port}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
