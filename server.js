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

const app = express();

// CORS configuration - أكثر مرونة لـ Vercel
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

// Serve static files from uploads directory
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

const PORT = process.env.PORT || 5000;

// تأكد من أننا لا نحاول الاتصال بـ MongoDB في البيئات التي لا تحتاجها
const startServer = async () => {
  try {
    // الاتصال بـ MongoDB فقط إذا كان متاحًا
    if (process.env.MONGODB_URI) {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
      });
      console.log('✅ Connected to MongoDB');
    } else {
      console.warn('⚠️ MONGODB_URI not set, running without database');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📁 Upload endpoint: /api/files/upload`);
      console.log(`👁️ View endpoint: /api/files/view/:id`);
      console.log(`⬇️ Download endpoint: /api/files/download/:id`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Server startup error:', err);
    process.exit(1);
  }
};

// تشغيل الخادم فقط إذا لم نكن في بيئة Vercel Serverless
// أو إذا كنا في وضع التطوير
if (process.env.VERCEL_ENV !== 'production' || process.env.NODE_ENV === 'development') {
  startServer();
}

// تصدير app لـ Vercel Serverless Functions
export default app;