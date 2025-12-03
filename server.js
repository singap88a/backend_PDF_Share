import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fileRoutes from './routes/files.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تسجيل الأخطاء غير المعالجة
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// MongoDB connection cache for serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  console.log('Attempting to connect to MongoDB...');
  
  if (cached.conn) {
    console.log('Using cached MongoDB connection');
    return cached.conn;
  }

  if (!cached.promise) {
    console.log('Creating new MongoDB connection promise');
    
    // تأكد من وجود URI
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts)
      .then((mongoose) => {
        console.log('✅ Connected to MongoDB successfully');
        return mongoose;
      })
      .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        cached.promise = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    console.error('Failed to connect to MongoDB:', e.message);
    throw e;
  }

  return cached.conn;
}

const app = express();

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.CLIENT_URL,
      'https://backend-pdf-share-tlgs.vercel.app'
    ].filter(Boolean);
    
    // السماح بدون origin (مثل Postman) أو إذا كان الأصل مسموحاً به
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Disposition'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// زيادة حجم الـ payload للرفع
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware للاتصال بقاعدة البيانات
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    } else {
      console.warn('⚠️ MONGODB_URI not set, running without database');
    }
    next();
  } catch (error) {
    console.error('Database connection middleware error:', error.message);
    res.status(500).json({ 
      error: 'Database connection failed',
      message: error.message 
    });
  }
});

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/files', fileRoutes);

// Test endpoints
app.get('/api/test', async (req, res) => {
  try {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
      res.json({ 
        status: 'success', 
        db: 'connected',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    } else {
      res.json({ 
        status: 'warning', 
        db: 'not_configured',
        message: 'MONGODB_URI is not set'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      db: 'failed',
      error: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version
  });
});

// إضافة route للصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    message: 'File Sharing API',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/files/upload',
      view: 'GET /api/files/view/:id',
      download: 'GET /api/files/download/:id',
      test: 'GET /api/test',
      health: 'GET /health'
    }
  });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  console.error('Error Stack:', err.stack);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    }
  });
});

// معالجة 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl 
  });
});

// Handler لـ Vercel Serverless Functions
const handler = async (req, res) => {
  try {
    await app(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    
    // إرسال الرد حتى لو حدث خطأ
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: error.message 
      });
    }
  }
};

export default handler;

// تشغيل الخادم محليًا فقط إذا لم نكن في بيئة Vercel
if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📁 Upload endpoint: POST /api/files/upload`);
    console.log(`👁️ View endpoint: GET /api/files/view/:id`);
    console.log(`⬇️ Download endpoint: GET /api/files/download/:id`);
    console.log(`🧪 Test endpoint: GET /api/test`);
    console.log(`🏥 Health check: GET /health`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 MongoDB URI: ${process.env.MONGODB_URI ? 'Set' : 'Not set'}`);
  });

  // معالجة إغلاق السيرفر بشكل أنيق
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    });
  });
}