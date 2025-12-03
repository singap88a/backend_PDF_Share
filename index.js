import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// CORS configuration
const corsOptions = {
  origin: '*', // في البداية نجعلها * للاختبار
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

// اتصال MongoDB
let isConnected = false;

async function connectDB() {
  if (isConnected) {
    console.log('✅ Using existing MongoDB connection');
    return;
  }

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = mongoose.connection.readyState === 1;
    
    mongoose.connection.on('connected', () => {
      console.log('✅ MongoDB Connected Successfully');
      isConnected = true;
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('🔌 MongoDB disconnected');
      isConnected = false;
    });

  } catch (err) {
    console.error('❌ MongoDB Connection Error:', err.message);
    throw err;
  }
}

// Schema للملفات
const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  size: { type: Number, required: true },
  mimeType: { type: String, required: true },
  fileId: { type: String, required: true, unique: true },
  uploadDate: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(+new Date() + 24*60*60*1000) } // 24 ساعة
});

const File = mongoose.model('File', fileSchema);

// تخزين الملفات في الذاكرة (في Vercel لا يمكننا حفظ على القرص)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    // قبول كل أنواع الملفات أو يمكنك تحديد أنواع معينة
    cb(null, true);
  }
});

// Routes
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    await connectDB();
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = crypto.randomBytes(16).toString('hex');
    
    const fileData = new File({
      filename: req.file.originalname,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
      fileId: fileId,
      fileBuffer: req.file.buffer // نخزن البافر في الذاكرة
    });

    await fileData.save();

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      fileId: fileId,
      downloadUrl: `${req.protocol}://${req.get('host')}/api/files/download/${fileId}`,
      viewUrl: `${req.protocol}://${req.get('host')}/api/files/view/${fileId}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

app.get('/api/files/view/:fileId', async (req, res) => {
  try {
    await connectDB();
    
    const fileData = await File.findOne({ fileId: req.params.fileId });
    
    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    // تحقق إذا انتهت صلاحية الملف
    if (new Date() > fileData.expiresAt) {
      await File.deleteOne({ fileId: req.params.fileId });
      return res.status(410).json({ error: 'File has expired' });
    }

    res.setHeader('Content-Type', fileData.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileData.originalName)}"`);
    
    // في حالة حقيقية، هنا نرجع الملف من التخزين
    res.json({
      message: 'File details',
      file: {
        filename: fileData.originalName,
        size: fileData.size,
        mimeType: fileData.mimeType,
        uploadDate: fileData.uploadDate,
        expiresAt: fileData.expiresAt
      }
    });
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/files/download/:fileId', async (req, res) => {
  try {
    await connectDB();
    
    const fileData = await File.findOne({ fileId: req.params.fileId });
    
    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    // تحقق إذا انتهت صلاحية الملف
    if (new Date() > fileData.expiresAt) {
      await File.deleteOne({ fileId: req.params.fileId });
      return res.status(410).json({ error: 'File has expired' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileData.originalName)}"`);
    res.setHeader('Content-Length', fileData.size);
    
    // في هذا المثال، نرسل رسالة فقط لأن الملف في الذاكرة
    // في التطبيق الحقيقي، نرسل البافر
    res.json({
      message: 'File download initiated',
      filename: fileData.originalName,
      size: fileData.size,
      directDownload: `${req.protocol}://${req.get('host')}/api/files/download/${fileData.fileId}/direct`
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: isConnected ? 'connected' : 'disconnected'
  });
});

// الصفحة الرئيسية
app.get('/', (req, res) => {
  res.json({
    message: 'File Sharing API is running! 🚀',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /api/files/upload',
      viewFile: 'GET /api/files/view/:fileId',
      download: 'GET /api/files/download/:fileId',
      health: 'GET /api/health'
    },
    note: 'Use multipart/form-data for file upload with field name "file"'
  });
});

// Vercel serverless handler
export default async (req, res) => {
  // تأكد من الاتصال بقاعدة البيانات
  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection failed:', error);
  }
  
  // معالجة الطلب باستخدام Express
  return app(req, res);
};

// إذا كان التشغيل محليًا
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  
  connectDB().then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running locally on port ${PORT}`);
      console.log(`📁 Health check: http://localhost:${PORT}/api/health`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
  });
}