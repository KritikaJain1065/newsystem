// server.js - Main server file for MediAssist Staff Recruitment

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Setup middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Create separate folders for photos and identity documents
    const fileType = file.fieldname === 'photo' ? 'photos' : 'identity';
    const fileDir = path.join(uploadDir, fileType);
    
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    
    cb(null, fileDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename using timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function(req, file, cb) {
    if (file.fieldname === 'photo') {
      // Accept only images for photo
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed for photo'));
      }
    } else if (file.fieldname === 'identity') {
      // Accept images and PDFs for identity
      if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
        return cb(new Error('Only image or PDF files are allowed for identity document'));
      }
    }
    cb(null, true);
  }
});

// Initialize SQLite database
const dbPath = path.join(__dirname, 'mediassist.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS applicants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      position TEXT NOT NULL,
      other_position TEXT,
      gender TEXT NOT NULL,
      experience INTEGER NOT NULL,
      photo_path TEXT NOT NULL,
      identity_path TEXT NOT NULL,
      application_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table', err.message);
    } else {
      console.log('Applicants table initialized');
    }
  });
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'recruitement_page.html'));
});

// Handle form submission
app.post('/submit-application', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'identity', maxCount: 1 }
]), (req, res) => {
  try {
    // Get form data
    const { name, email, phone, address, position, otherPosition, gender, experience } = req.body;
    
    // Get file paths
    const photoPath = req.files['photo'] ? req.files['photo'][0].path : '';
    const identityPath = req.files['identity'] ? req.files['identity'][0].path : '';
    
    // Validate required fields
    if (!name || !phone || !address || !position || !gender || !experience) {
      return res.status(400).json({ success: false, message: 'Required fields are missing' });
    }
    
    // Store in database
    const finalPosition = position === 'Other' ? otherPosition : position;
    
    db.run(
      `INSERT INTO applicants (
        name, email, phone, address, position, other_position, 
        gender, experience, photo_path, identity_path
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone, address, position, otherPosition, gender, experience, photoPath, identityPath],
      function(err) {
        if (err) {
          console.error('Error inserting record', err.message);
          return res.status(500).json({ success: false, message: 'Database error' });
        }
        
        // Return success with the ID of the new record
        res.status(201).json({ 
          success: true, 
          message: 'Application submitted successfully', 
          applicationId: this.lastID 
        });
      }
    );
  } catch (error) {
    console.error('Application submission error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin route to view all applications
app.get('/admin/applications', (req, res) => {
  db.all(`SELECT * FROM applicants ORDER BY application_date DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, applications: rows });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});