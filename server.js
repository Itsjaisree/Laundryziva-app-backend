const express = require('express');
const cors = require('cors');
const path = require('path');
const { initSchema } = require('./models/schema');
const { seedDatabase } = require('./services/seedService');

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

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend clients
app.use(cors());
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

    const HOST = process.env.HOST || '0.0.0.0';
    app.listen(PORT, HOST, () => {
      console.log(`====================================================`);
      console.log(`Laundryziva Backend Server is running!`);
      console.log(`App Server Access: http://168.144.68.147:${PORT}`);
      console.log(`Local Access: http://localhost:${PORT}`);
      console.log(`Health Check: http://168.144.68.147:${PORT}/api/health`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
