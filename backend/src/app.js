const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const api = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/api', api);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
