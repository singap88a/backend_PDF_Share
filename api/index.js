import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fileRoutes from '../routes/files.js';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration - مناسب لـ Vercel
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.CLIENT_URL, 'https://yourdomain.vercel.app']
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

// Routes
app.use('/api/files', fileRoutes);

// Serve static files locally فقط
if (process.env.NODE_ENV === 'development') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// الصفحة الرئيسية
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

// xử lý 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// اتصال MongoDB مع caching
let cachedDb = null;

async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ No MongoDB URI found');
    return null;
  }

  // إذا كان الاتصال موجود بالفعل
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // إذا كان لدينا اتصال مخزن
  if (cachedDb) {
    return cachedDb;
  }

  try {
    console.log('🔄 Connecting to MongoDB...');

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // زيادة المهلة
      socketTimeoutMS: 45000, // زيادة مهلة السوكيت
      maxPoolSize: 10, // تقليل حجم الـ pool
    });

    cachedDb = mongoose.connection;

    // معالجة الأخطاء
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      cachedDb = null;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
      cachedDb = null;
    });

    console.log('✅ MongoDB Connected');
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    throw err;
  }
}

// Middleware لضمان اتصال قاعدة البيانات
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error('Database connection failed:', error);
    res.status(500).json({
      error: 'Database connection failed',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// تشغيل السيرفر محليًا فقط
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 5000;

  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  });
}

// Handler for Vercel Serverless Functions
export default async function handler(req, res) {
  try {
    // الاتصال بقاعدة البيانات أولاً
    await connectDB();

    // معالجة الطلب
    return app(req, res);
  } catch (error) {
    console.error('❌ Serverless Function Error:', error);

    // إرسال رد خطأ مناسب
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  }
}
