# Backend Server for PDF Sharing

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Make sure MongoDB is running on your system.

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

- `POST /api/files/upload` - Upload a PDF file
- `GET /api/files` - Get all uploaded files
- `GET /api/files/:id` - Get a specific file by ID
- `GET /api/files/download/:id` - Download a file
- `DELETE /api/files/:id` - Delete a file
- `GET /api/health` - Health check

## Requirements

- Node.js 18+
- MongoDB 6+
