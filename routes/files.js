import express from 'express';
import upload from '../middleware/upload.js';
import File from '../models/File.js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Upload a new PDF file
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileId = uuidv4();
    const fileUrl = `${req.protocol}://${req.get('host')}/api/files/view/${fileId}`;
    const downloadUrl = `${req.protocol}://${req.get('host')}/api/files/download/${fileId}`;

    // Save file data as Buffer in database
    const fileData = new File({
      filename: req.file.originalname,
      storedFilename: fileId, // Use fileId as stored filename
      size: req.file.size,
      uploadedAt: new Date(),
      url: fileUrl, // رابط العرض في المتصفح
      downloadUrl: downloadUrl, // رابط التنزيل
      fileId: fileId,
      fileBuffer: req.file.buffer, // Store file buffer in database
    });

    await fileData.save();

    res.status(201).json({
      success: true,
      file: {
        url: fileData.url,
        downloadUrl: fileData.downloadUrl,
        name: fileData.filename,
        size: fileData.size,
        uploadedAt: fileData.uploadedAt,
        fileId: fileData.fileId,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Get all files
router.get('/', async (req, res) => {
  try {
    const files = await File.find().sort({ uploadedAt: -1 });
    
    const formattedFiles = files.map(file => ({
      url: file.url,
      downloadUrl: file.downloadUrl,
      name: file.filename,
      size: file.size,
      uploadedAt: file.uploadedAt,
      fileId: file.fileId,
    }));

    res.json({ success: true, files: formattedFiles });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get a specific file by ID
router.get('/:id', async (req, res) => {
  try {
    const file = await File.findOne({ fileId: req.params.id });
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      success: true,
      file: {
        url: file.url,
        downloadUrl: file.downloadUrl,
        name: file.filename,
        size: file.size,
        uploadedAt: file.uploadedAt,
        fileId: file.fileId,
      },
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

// View a file (opens in browser)
router.get('/view/:id', async (req, res) => {
  try {
    const file = await File.findOne({ fileId: req.params.id });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Send file buffer from database
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(file.filename) + '"');
    res.send(file.fileBuffer);
  } catch (error) {
    console.error('View error:', error);
    res.status(500).json({ error: 'Failed to view file' });
  }
});

// Download a file (forces download)
router.get('/download/:id', async (req, res) => {
  try {
    const file = await File.findOne({ fileId: req.params.id });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set headers to force download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(file.filename) + '"');
    res.send(file.fileBuffer);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete a file
router.delete('/:id', async (req, res) => {
  try {
    const file = await File.findOne({ fileId: req.params.id });

    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from database (no physical file to delete since it's stored in DB)
    await File.deleteOne({ fileId: req.params.id });

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;