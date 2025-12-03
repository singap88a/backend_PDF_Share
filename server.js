import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables FIRST
dotenv.config();

console.log('🚀 Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);

const app = express();

// CORS - أبسط إعدادات
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple test route
app.get('/', (req, res) => {
  console.log('Root route called');
  res.json({ 
    success: true,
    message: 'PDF Sharing API is running!',
    timestamp: new Date().toISOString()
  });
});

// Test database connection
app.get('/api/test', async (req, res) => {
  try {
    const isConnected = mongoose.connection.readyState === 1;
    res.json({ 
      database: isConnected ? 'connected' : 'disconnected',
      readyState: mongoose.connection.readyState
    });
  } catch (error) {
    res.json({ error: error.message });
  }
});

// Health check for Vercel
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Connect to MongoDB with better error handling
const connectDB = async () => {
  try {
    console.log('🔗 Attempting to connect to MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB Connected Successfully');
    
    mongoose.connection.on('error', err => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    // Don't crash - allow server to start without DB
  }
};

// Initialize database connection
connectDB();

// Handle 404
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    path: req.path,
    method: req.method 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// Export app for Vercel
export default app;