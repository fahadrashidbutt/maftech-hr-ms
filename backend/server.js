// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import './src/db.js';

import authRoutes from './src/routes/auth.js';
import employeeRoutes from './src/routes/employees.js';
import leaveRoutes from './src/routes/leave.js';
import documentRoutes from './src/routes/documents.js';
import recruitmentRoutes from './src/routes/recruitment.js';
import dashboardRoutes from './src/routes/dashboard.js';
import adminRoutes from './src/routes/admin.js';
import shiftRoutes from './src/routes/shifts.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/recruitment', recruitmentRoutes);
app.use('/api', dashboardRoutes); // /api/ (dashboard) + /api/notifications
app.use('/api/admin', adminRoutes);
app.use('/api/shifts', shiftRoutes);

// Fallback error handler so multer/db errors return JSON, not HTML.
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error.' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`HRIS API running on http://localhost:${PORT}`));
