import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { seedDatabase } from './seed.js';
import authRoutes from './routes/auth.js';
import adsRoutes from './routes/ads.js';
import earningsRoutes from './routes/earnings.js';
import referralsRoutes from './routes/referrals.js';
import advertiserRoutes from './routes/advertiser.js';

initDb();
seedDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'whyl-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/ads', adsRoutes);
app.use('/api/earnings', earningsRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/advertiser', advertiserRoutes);

app.listen(PORT, () => {
  console.log(`WHYL API running on http://localhost:${PORT}`);
});
