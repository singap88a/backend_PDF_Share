import express from 'express';
import mongoose from 'mongoose';
import fileRoutes from '../routes/files.js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// ====== CORS ======
app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 🔥 MongoDB Connection Cache
let conn = null;
async function connectDB() {
  if (conn) return conn;

  conn = mongoose.connect(process.env.MONGODB_URI);
  await conn;
  console.log("✅ MongoDB Connected (Serverless)");
  return conn;
}

// Middleware ensures DB connected
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ==== Routes ====
app.use('/api/files', fileRoutes);

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: "OK", serverless: true });
});

// Handler for Vercel
export default async function handler(req, res) {
  await connectDB();
  return app(req, res);
}
