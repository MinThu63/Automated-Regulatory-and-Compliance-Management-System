require('dotenv').config();

const express = require('express');
const cors = require('cors');
const pool = require('./db');
const { startFeedScheduler } = require('./services/feedIntegrator');

// Import route modules
const authRoutes = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const dashboardRoutes = require('./routes/dashboard');
const regulationRoutes = require('./routes/regulations');
const taskRoutes = require('./routes/tasks');
const gapRoutes = require('./routes/gaps');
const sourceRoutes = require('./routes/sources');
const policyRoutes = require('./routes/policies');
const auditRoutes = require('./routes/audit');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Register routes
app.use('/api', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/regulations', regulationRoutes);
app.use('/api/regulation-changes', require('./routes/changes'));
app.use('/api/tasks', taskRoutes);
app.use('/api/compliance-gaps', gapRoutes);
app.use('/api/regulatory-sources', sourceRoutes);
app.use('/api/internal-policies', policyRoutes);
app.use('/api/audit-logs', auditRoutes);

// Start server
const PORT = process.env.API_PORT || 3000;

app.listen(PORT, async () => {
  console.log('Server is running on port ' + PORT);
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully to', process.env.DB_NAME);
    startFeedScheduler();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
