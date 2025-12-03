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

// اتصال MongoDB (يعمل داخل Vercel أيضًا)
async function connectDB() {
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️ No MongoDB URI found');
    return;
  }

  if (mongoose.connection.readyState === 1) return; // متصل بالفعل

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ MongoDB Connected');
  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err);
  }
}

// تشغيل السيرفر محليًا فقط
if (process.env.NODE_ENV === 'development') {
  const PORT = process.env.PORT || 5000;

  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  });
}

// Vercel يستدعي هذا بشكل Serverless بدون listen()
export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}
