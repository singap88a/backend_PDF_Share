
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

// MongoDB connection cache for serverless
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ Connected to MongoDB');
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

const app = express();

// CORS configuration - أكثر مرونة لـ Vercel
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.CLIENT_URL, 'https://backend-pdf-share-tlgs.vercel.app', 'http://localhost:5173']
    : 'http://localhost:5173',
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

// Connect to database on each request for serverless
app.use(async (req, res, next) => {
  try {
    if (process.env.MONGODB_URI) {
      await connectToDatabase();
    } else {
      console.warn('⚠️ MONGODB_URI not set, running without database');
    }
    next();
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Routes
app.use('/api/files', fileRoutes);

// Serve static files from uploads directory (though we don't use it anymore)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// إضافة route للصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    message: 'File Sharing API',
    endpoints: {
      upload: '/api/files/upload',
      view: '/api/files/view/:id',
      download: '/api/files/download/:id'
    }
  });
});

// معالجة الأخطاء
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// معالجة 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// تصدير app لـ Vercel Serverless Functions
export default app;

// تشغيل الخادم محليًا فقط إذا لم نكن في بيئة Vercel
if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📁 Upload endpoint: /api/files/upload`);
    console.log(`👁️ View endpoint: /api/files/view/:id`);
    console.log(`⬇️ Download endpoint: /api/files/download/:id`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}
