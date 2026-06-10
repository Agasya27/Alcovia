import express from 'express';
import cors from 'cors';
import './db/serverDb'; // runs migrations + seed on import
import syncRouter from './routes/sync';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, timestamp: Date.now() });
});

app.use(syncRouter);

app.listen(PORT, () => {
  console.log(`Alcovia server listening on http://localhost:${PORT}`);
});
