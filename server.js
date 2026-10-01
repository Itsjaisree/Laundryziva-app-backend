require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { initSchema } = require('./models/schema');
const { seedDatabase } = require('./services/seedService');
const { syncLiveDeviceStates } = require('./services/deviceServerService');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const roleRoutes = require('./routes/roleRoutes');
const machineRoutes = require('./routes/machineRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const firmwareRoutes = require('./routes/firmwareRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const customerCareRoutes = require('./routes/customerCareRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const technicianRoutes = require('./routes/technicianRoutes');
const internalRoutes = require('./routes/internalRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust the nginx reverse proxy for correct client IPs (rate limiting, logging)
app.set('trust proxy', 1);

app.use(helmet());

// Enable CORS only for known web origins. Native mobile requests (React Native / Expo Go)
// don't send an Origin header at all and are unaffected by this restriction.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://app.upiziva.com,http://localhost:8081,http://localhost:19006')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Laundryziva Backend API Service is running', timestamp: new Date().toISOString() });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api', machineRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/firmware', firmwareRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/customercare', customerCareRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/technician', technicianRoutes);
app.use('/api/internal', internalRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initSchema();
    await seedDatabase();
    await syncLiveDeviceStates();
    setInterval(syncLiveDeviceStates, 15000);

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`====================================================`);
      console.log(`Laundryziva Backend Server is running!`);
      console.log(`Local Access: http://localhost:${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
