import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  storedFilename: {
    type: String,
    required: true,
    unique: true,
  },
  size: {
    type: Number,
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
  url: {
    type: String,
    required: true,
  },
  downloadUrl: {
    type: String,
    required: true,
  },
  fileId: {
    type: String,
    required: true,
    unique: true,
  },
});

const File = mongoose.model('File', fileSchema);

export default File;