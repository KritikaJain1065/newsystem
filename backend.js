// Unified Backend Server for MediAssist
// This file combines all backend functionality into one file

// Common Dependencies
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// API Keys from environment variables with fallbacks
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'dummy_youtube_key';
const MAPS_API_KEY = process.env.MAPS_API_KEY || 'dummy_maps_key';
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'dummy_google_maps_key';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'dummy_gemini_key';

// Validate critical API keys
console.log('Checking API keys...');
if (!GEMINI_API_KEY || GEMINI_API_KEY === 'dummy_gemini_key') {
    console.warn('WARNING: GEMINI_API_KEY is missing or using a dummy value. Chatbot AI functionality will be limited.');
}

console.log('Environment variables loaded with default fallbacks if needed');
console.log('Starting server...');

// Middleware
app.use(cors({
    origin: '*', // In production, replace with your frontend domain
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));
// Add static file serving for chatbot
app.use('/chatbot', express.static(path.join(__dirname, 'chatbot')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Add this near your other middleware
app.use((err, req, res, next) => {
    console.error('Emergency Service Error:', err);
    res.status(500).json({
        success: false,
        message: 'An error occurred processing your emergency request',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/signin');
};

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

// Initialize SQLite Databases
// 1. Main Users Database
const usersDb = new sqlite3.Database('./new_users.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else {
        console.log('Connected to users SQLite database');
        usersDb.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// 2. Staff Recruitment Database
const recruitmentDb = new sqlite3.Database('./mediassist.db', (err) => {
  if (err) {
    console.error('Error opening recruitment database', err.message);
  } else {
    console.log('Connected to the recruitment SQLite database');
    recruitmentDb.run(`
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
        console.error('Error creating applicants table', err.message);
      } else {
        console.log('Applicants table initialized');
      }
    });
  }
});

// 3. Healthcare In-Memory Database
const healthcareDb = new sqlite3.Database(':memory:');
healthcareDb.serialize(() => {
  // Create patients table with updated schema
  healthcareDb.run(`CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age INTEGER,
    gender TEXT
  )`);

  // Create health records table
  healthcareDb.run(`CREATE TABLE health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    record TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  // Create prescriptions table
  healthcareDb.run(`CREATE TABLE prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    prescription TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  // Create lab reports table
  healthcareDb.run(`CREATE TABLE lab_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    report TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);
 
  // Create treatment plans table with updated schema
  healthcareDb.run(`CREATE TABLE treatment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    title TEXT,
    description TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  // Insert sample data
  healthcareDb.run(`INSERT INTO patients (name, age, gender) VALUES ('John Doe', 30, 'Male')`);
  healthcareDb.run(`INSERT INTO health_records (patient_id, record) VALUES (1, 'No known allergies')`);
  healthcareDb.run(`INSERT INTO prescriptions (patient_id, prescription) VALUES (1, 'Ibuprofen 200mg')`);
  healthcareDb.run(`INSERT INTO lab_reports (patient_id, report) VALUES (1, 'Blood test normal')`);
  healthcareDb.run(`INSERT INTO treatment_plans (patient_id, title, description) 
    VALUES (1, 'Physical Therapy', 'Twice weekly sessions for 3 months')`);
});

// 4. Doctor Appointment Database
const appointmentDb = new sqlite3.Database('./appointment_system.db', (err) => {
  if (err) {
    console.error('Error opening appointment database:', err.message);
  } else {
    console.log('Connected to the appointment SQLite database');
    
    // Create doctors table if it doesn't exist
    appointmentDb.run(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        languages TEXT NOT NULL DEFAULT 'English, Hindi',
        availability TEXT NOT NULL DEFAULT 'Mon-Sat: 9:00 AM - 5:00 PM',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating doctors table:', err.message);
        return;
      }
      console.log('Doctors table initialized');

      // Check if we have any doctors in the database
      appointmentDb.get('SELECT COUNT(*) as count FROM doctors', [], (err, result) => {
        if (err) {
          console.error('Error checking doctors count:', err.message);
          return;
        }

        console.log(`Current number of doctors in database: ${result.count}`);

        // Add sample doctors if none exist
        if (result.count === 0) {
          const sampleDoctors = [
            {
              name: 'John Smith',
              specialization: 'Cardiology',
              phone: '(123) 456-7890',
              address: '123 Main St, Medical Center, Floor 3'
            },
            {
              name: 'Sarah Johnson',
              specialization: 'Pediatrics',
              phone: '(123) 456-7891',
              address: '456 Health Ave, Children\'s Hospital, Wing B'
            },
            {
              name: 'David Wilson',
              specialization: 'Orthopedics',
              phone: '(123) 456-7892',
              address: '789 Hospital Blvd, Orthopedic Center, Suite 201'
            },
            {
              name: 'Emily Martinez',
              specialization: 'Dermatology',
              phone: '(123) 456-7893',
              address: '321 Skin Care Lane, Medical Plaza, Room 105'
            }
          ];

          const stmt = appointmentDb.prepare(`
            INSERT INTO doctors (name, specialization, phone, address)
            VALUES (?, ?, ?, ?)`
          );

          let insertedCount = 0;
          sampleDoctors.forEach(doctor => {
            stmt.run(
              doctor.name,
              doctor.specialization,
              doctor.phone,
              doctor.address,
              (err) => {
                if (err) {
                  console.error('Error adding doctor:', err.message);
                } else {
                  insertedCount++;
                  if (insertedCount === sampleDoctors.length) {
                    console.log(`Successfully added ${insertedCount} sample doctors`);
                    stmt.finalize();
                  }
                }
              }
            );
          });
        }
      });
    });
  }
});

// 5. Telehealth Database
const telehealthDb = new sqlite3.Database('./telehealth.db', (err) => {
  if (err) {
    console.error('Error opening telehealth database', err.message);
  } else {
    console.log('Connected to the telehealth SQLite database');
    
    // Create consultations table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS consultations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        problem TEXT NOT NULL,
        location TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating consultations table', err.message);
      } else {
        console.log('Consultations table initialized');
      }
    });

    // Create insurance_verifications table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS insurance_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        memberId TEXT NOT NULL,
        fullName TEXT,
        email TEXT,
        verified BOOLEAN DEFAULT 0,
        followUp BOOLEAN DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating insurance verifications table', err.message);
      } else {
        console.log('Insurance verifications table initialized');
      }
    });

    // Create telehealth_appointments table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS telehealth_appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        specialty TEXT NOT NULL,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT DEFAULT 'scheduled',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating telehealth appointments table', err.message);
      } else {
        console.log('Telehealth appointments table initialized');
      }
    });

    // Create emergency_alerts table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS emergency_alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        location TEXT NOT NULL,
        coordinates TEXT,
        emergency_type TEXT,
        estimated_response_time INTEGER,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating emergency_alerts table:', err.message);
      } else {
        console.log('Emergency alerts table initialized');
      }
    });

    // Create emergency_requests table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS emergency_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        location TEXT NOT NULL,
        coordinates TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'dispatched',
        nearest_service TEXT,
        estimated_response TEXT,
        emergency_id TEXT UNIQUE
      )
    `);
  }
});

// Mock data for guest page backend
const mockDB = {
  mobileClinics: [
    { id: 'mc001', location: 'Downtown', date: '2025-03-25', status: 'scheduled' },
    { id: 'mc002', location: 'Riverside', date: '2025-03-27', status: 'in-transit' }
  ],
  facilities: [
    { id: 'f001', name: "Community Health Center", type: "health-center", address: "123 Main St", phone: "555-1234", emergency: true, location: { lat: 40.7128, lng: -74.0060 } },
    { id: 'f002', name: "City Hospital", type: "hospital", address: "456 Oak Ave", phone: "555-5678", emergency: true, location: { lat: 40.7138, lng: -74.0050 } },
    { id: 'f003', name: "MediPlus Pharmacy", type: "pharmacy", address: "789 Elm St", phone: "555-9012", emergency: false, location: { lat: 40.7118, lng: -74.0070 } },
    { id: 'f004', name: "Family Care Clinic", type: "clinic", address: "321 Pine Rd", phone: "555-3456", emergency: false, location: { lat: 40.7108, lng: -74.0080 } },
    { id: 'f005', name: "Urgent Care Center", type: "clinic", address: "555 Cedar Blvd", phone: "555-7890", emergency: true, location: { lat: 40.7148, lng: -74.0040 } }
  ],
  contacts: [],
  emergencyRequests: [],
  campaigns: [
    { id: 'c001', name: "Vaccination Awareness", type: "vaccination", startDate: "2025-03-28", endDate: "2025-04-28" },
    { id: 'c002', name: "Diabetes Prevention", type: "diabetes", startDate: "2025-04-15", endDate: "2025-05-15" }
  ],
  users: [
    { id: 'u001', name: "John Doe", email: "john@example.com", phone: "555-1111" }
  ]
};

// Helper function to calculate distance
function calculateDistance(lat1, lng1, lat2, lng2) {
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lng1 - lng2);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
}

//===============================================
// ROUTES - MAIN APP ROUTES
//===============================================

// Serve Static HTML Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'sign_up.html')));
app.get('/signin', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'sign_in.html')));
app.get('/main', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'main_websitepage.html')));

// Splash and onboarding routes
app.get('/splash', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'splash.html'));
});

app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'advertisment_all_login_Connected.html'));
});

// Emergency service route - accessible without login
app.get('/emergency', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'final_guestpage.html'));
});

// User Dashboard (Protected)
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.send(`
        <h1>Welcome ${req.session.user.username}!</h1>
        <p>Email: ${req.session.user.email}</p>
        <a href="/logout">Logout</a>
    `);
});

// Recruitment page
app.get('/recruitment', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'recruitement_page.html'));
});

//===============================================
// USER AUTHENTICATION API
//===============================================

// User Registration (Sign Up)
app.post('/api/signup', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    try {
        const user = await new Promise((resolve, reject) => {
            usersDb.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
                if (err) reject(err);
                else resolve(user);
            });
        });

        if (user) return res.status(409).json({ success: false, message: 'Username or email already exists' });

        const hash = await bcrypt.hash(password, 10);
        await new Promise((resolve, reject) => {
            usersDb.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
                [username, email, hash], function(err) {
                    if (err) reject(err);
                    else resolve(this.lastID);
            });
        });

        res.status(201).json({ success: true, message: 'User registered successfully' });
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// User Login (Sign In)
app.post('/api/signin', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    usersDb.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

        bcrypt.compare(password, user.password, (err, match) => {
            if (err) return res.status(500).json({ success: false, message: 'Error comparing passwords' });
            if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password' });

            req.session.user = { id: user.id, username: user.username, email: user.email };
            res.json({ success: true, message: 'Login successful', user: req.session.user });
        });
    });
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/signin');
});

//===============================================
// STAFF RECRUITMENT API
//===============================================

// Handle form submission for recruitment
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
    
    recruitmentDb.run(
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
  recruitmentDb.all(`SELECT * FROM applicants ORDER BY application_date DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, applications: rows });
  });
});

//===============================================
// EMERGENCY SERVICES API
//===============================================

// API for emergency service
app.post('/api/emergency-connect', (req, res) => {
    const { location, coordinates } = req.body;
    
    if (!location) {
        return res.status(400).json({ 
            success: false, 
            message: 'Location is required' 
        });
    }

    const emergencyId = 'EM-' + Math.floor(Math.random() * 10000);
    const estimatedResponse = '8-10 minutes';
    const nearestService = findNearestService(coordinates);

    telehealthDb.run(
        `INSERT INTO emergency_requests (
            location, coordinates, nearest_service, 
            estimated_response, emergency_id
        ) VALUES (?, ?, ?, ?, ?)`,
        [
            location,
            JSON.stringify(coordinates),
            nearestService,
            estimatedResponse,
            emergencyId
        ],
        function(err) {
            if (err) {
                console.error('Error saving emergency request:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to process emergency request'
                });
            }

            res.json({
                success: true,
                emergencyId: emergencyId,
                nearestService: nearestService,
                estimatedResponse: estimatedResponse,
                message: 'Emergency services have been notified'
            });
        }
    );
});

// Helper function to find nearest service
function findNearestService(coordinates) {
    // If coordinates are provided, calculate nearest facility
    if (coordinates) {
        const facilities = mockDB.facilities.filter(f => f.emergency);
        let nearest = facilities[0];
        let shortestDistance = Number.MAX_VALUE;

        facilities.forEach(facility => {
            const distance = calculateDistance(
                coordinates.lat,
                coordinates.lng,
                facility.location.lat,
                facility.location.lng
            );
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearest = facility;
            }
        });
        return nearest.name;
    }
    return "City Central Hospital"; // Default fallback
}



//===============================================
// HEALTH CAMPAIGNS API
//===============================================

// Indian Health Campaigns API
app.get('/api/health-campaigns', (req, res) => {
    const campaigns = [
        {
            id: 1,
            title: "Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (PM-JAY)",
            shortDescription: "Provides health coverage up to ₹5 lakhs per family per year for secondary and tertiary care hospitalization.",
            fullDescription: "Ayushman Bharat PM-JAY is the largest health assurance scheme in the world which aims at providing a health cover of Rs. 5 lakhs per family per year for secondary and tertiary care hospitalization.",
            eligibility: "Economically vulnerable families identified through Socio-Economic Caste Census (SECC) 2011 data",
            benefits: ["Cashless and paperless access to healthcare services", "No cap on family size, age or gender", "Pre-existing diseases covered", "All costs related to treatment covered"],
            applicationProcess: "Visit your nearest Ayushman Bharat Kendra, Common Service Centre, or register through the official PM-JAY portal.",
            officialWebsite: "https://pmjay.gov.in/",
            applicationLink: "https://pmjay.gov.in/beneficiary/login",
            contactNumber: "14555",
            lastUpdated: "2023-05-15"
        },
        {
            id: 2,
            title: "National Health Mission (NHM)",
            shortDescription: "Umbrella program for various health initiatives aimed at improving healthcare for rural and urban populations.",
            fullDescription: "The National Health Mission encompasses two sub-missions: the National Rural Health Mission (NRHM) and the National Urban Health Mission (NUHM) to provide accessible, affordable and quality healthcare to the rural and urban population.",
            eligibility: "All citizens of India",
            benefits: ["Improved access to quality healthcare", "Reduced out-of-pocket expenses", "Focus on maternal and child health", "Prevention and control of communicable and non-communicable diseases"],
            applicationProcess: "Access services through government hospitals, health centers, and accredited social health activists (ASHAs).",
            officialWebsite: "https://nhm.gov.in/",
            contactNumber: "1800-180-1104",
            lastUpdated: "2023-06-10"
        }
    ];
    
    res.json({ success: true, campaigns });
});

//===============================================
// HEALTHCARE RECORDS API
//===============================================

// Healthcare API Endpoints - GET Methods
app.get('/api/patients', (req, res) => {
  healthcareDb.all('SELECT * FROM patients', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ patients: rows });
  });
});

app.get('/api/health-records', (req, res) => {
  healthcareDb.all('SELECT * FROM health_records', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ healthRecords: rows });
  });
});

app.get('/api/prescriptions', (req, res) => {
  healthcareDb.all('SELECT * FROM prescriptions', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ prescriptions: rows });
  });
});

app.get('/api/lab-reports', (req, res) => {
  healthcareDb.all('SELECT * FROM lab_reports', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ labReports: rows });
  });
});

app.get('/api/treatment-plans', (req, res) => {
  healthcareDb.all('SELECT * FROM treatment_plans', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ treatmentPlans: rows });
  });
});

// Healthcare API Endpoints - POST Methods
app.post('/api/patients', (req, res) => {
  const { name, age, gender } = req.body;
  
  if (!name || !age || !gender) {
    return res.status(400).json({ error: 'Name, age, and gender are required' });
  }
  
  const sql = 'INSERT INTO patients (name, age, gender) VALUES (?, ?, ?)';
  healthcareDb.run(sql, [name, age, gender], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      message: 'Patient added successfully',
      id: this.lastID
    });
  });
});

// Add other POST endpoints similarly...

// Healthcare API Endpoints - GET by Patient ID
app.get('/api/treatment-plans/:patientId', (req, res) => {
  const patientId = req.params.patientId;
  
  healthcareDb.all('SELECT * FROM treatment_plans WHERE patient_id = ?', [patientId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ treatmentPlans: rows });
  });
});

// Add other GET by patient ID endpoints similarly...

//===============================================
// CONTACT API
//===============================================

// Contact form API
app.post('/api/contact', (req, res) => {
    const { name, email, phone, message } = req.body;
    
    // Save to mock database
    const contact = {
        id: uuidv4(),
        name,
        email,
        phone,
        message,
        timestamp: new Date().toISOString()
    };
    
    mockDB.contacts.push(contact);
    
    const response = {
        success: true,
        message: "Thank you for your message. We will contact you shortly."
    };
    
    setTimeout(() => {
        res.json(response);
    }, 1000);
});

//===============================================
// TELEHEALTH SERVICES API
//===============================================

// Serve telehealth page
app.get('/telehealth', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'telehealth_services.html'));
});

// Submit consultation request
app.post('/api/telehealth/consultation', (req, res) => {
  const { fullName, email, phone, problem, location } = req.body;

  if (!fullName || !email || !phone || !problem) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required fields' 
    });
  }

  telehealthDb.run(
    `INSERT INTO consultations (fullName, email, phone, problem, location) 
     VALUES (?, ?, ?, ?, ?)`,
    [fullName, email, phone, problem, location],
    function(err) {
      if (err) {
        console.error('Error saving consultation:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error saving consultation request' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Consultation request submitted successfully',
        consultationId: this.lastID,
        requestId: `TC${String(this.lastID).padStart(4, '0')}`
      });
    }
  );
});

// Verify insurance
app.post('/api/telehealth/insurance', (req, res) => {
  const { provider, memberId, fullName, email, followUp } = req.body;

  if (!provider || !memberId) {
    return res.status(400).json({ 
      success: false, 
      message: 'Provider and member ID are required' 
    });
  }

  telehealthDb.run(
    `INSERT INTO insurance_verifications 
     (provider, memberId, fullName, email, followUp, verified) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [provider, memberId, fullName, email, followUp ? 1 : 0, 0],
    function(err) {
      if (err) {
        console.error('Error saving insurance verification:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error processing insurance verification' 
        });
      }

      // Simulate verification process
      const isVerified = Math.random() > 0.3; // 70% chance of success

      // Update verification status
      telehealthDb.run(
        'UPDATE insurance_verifications SET verified = ? WHERE id = ?',
        [isVerified ? 1 : 0, this.lastID],
        (updateErr) => {
          if (updateErr) {
            console.error('Error updating verification status:', updateErr);
          }
        }
      );

      res.status(201).json({
        success: true,
        verified: isVerified,
        verificationId: this.lastID,
        requestId: `IV${String(this.lastID).padStart(4, '0')}`,
        details: isVerified ? {
          coverageLevel: 'Standard',
          copay: '$20',
          includes: ['Telehealth consultations', 'Online prescription services']
        } : null
      });
    }
  );
});

// Schedule telehealth appointment
app.post('/api/telehealth/appointment', (req, res) => {
  const { date, time, specialty, fullName, email } = req.body;

  if (!date || !time || !specialty || !fullName || !email) {
    return res.status(400).json({ 
      success: false, 
      message: 'All fields are required' 
    });
  }

  telehealthDb.run(
    `INSERT INTO telehealth_appointments (date, time, specialty, fullName, email) 
     VALUES (?, ?, ?, ?, ?)`,
    [date, time, specialty, fullName, email],
    function(err) {
      if (err) {
        console.error('Error scheduling appointment:', err);
        return res.status(500).json({ 
          success: false, 
          message: 'Error scheduling appointment' 
        });
      }

      res.status(201).json({
        success: true,
        message: 'Appointment scheduled successfully',
        appointmentId: this.lastID,
        requestId: `TA${String(this.lastID).padStart(4, '0')}`
      });
    }
  );
});

// Get all consultations
app.get('/api/telehealth/consultations', (req, res) => {
  telehealthDb.all('SELECT * FROM consultations ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Error fetching consultations:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching consultations' 
      });
    }
    res.json({ success: true, consultations: rows });
  });
});

// Get all insurance verifications
app.get('/api/telehealth/insurance', (req, res) => {
  telehealthDb.all('SELECT * FROM insurance_verifications ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Error fetching insurance verifications:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching insurance verifications' 
      });
    }
    res.json({ success: true, verifications: rows });
  });
});

// Get all telehealth appointments
app.get('/api/telehealth/appointments', (req, res) => {
  telehealthDb.all('SELECT * FROM telehealth_appointments ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      console.error('Error fetching appointments:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error fetching appointments' 
      });
    }
    res.json({ success: true, appointments: rows });
  });
});

// Handle SOS Alert
app.post('/api/telehealth/sos', (req, res) => {
  const { fullName, location, coordinates, emergency_type } = req.body;

  if (!fullName || !location) {
    return res.status(400).json({
      success: false,
      message: 'Name and location are required'
    });
  }

  // In a real application, this would trigger emergency services
  // For now, we'll simulate the response
  const estimatedTime = Math.floor(Math.random() * 10) + 5; // 5-15 minutes
  
  telehealthDb.run(
    `INSERT INTO emergency_alerts (
      fullName, location, coordinates, emergency_type, estimated_response_time
    ) VALUES (?, ?, ?, ?, ?)`,
    [fullName, location, JSON.stringify(coordinates), emergency_type, estimatedTime],
    function(err) {
      if (err) {
        console.error('Error saving SOS alert:', err);
        return res.status(500).json({
          success: false,
          message: 'Error processing SOS alert'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Emergency services have been notified',
        estimatedResponse: `${estimatedTime} minutes`,
        alertId: `SOS${String(this.lastID).padStart(4, '0')}`,
        instructions: 'Stay calm. Emergency services are on their way.'
      });
    }
  );
});

//===============================================
// START SERVER
//===============================================

// Server will be started at the end of the file after all routes are defined

//===============================================
// CHATBOT IMPLEMENTATION
//===============================================

// Initial system prompt for medical chatbot persona
const SYSTEM_PROMPT = `
You are MediAssist, a helpful medical chatbot. Your purpose is to provide general health information and guidance.
Important rules to follow:
1. Always clarify you are not a substitute for professional medical advice
2. For severe or urgent symptoms, recommend seeking immediate medical attention
3. Provide factual, evidence-based information only
4. For specific treatments or diagnoses, recommend consulting with a healthcare provider
5. Be empathetic but professional
6. Keep responses concise and clear
7. For serious conditions like chest pain, severe bleeding, difficulty breathing, or stroke symptoms, emphasize the need for immediate emergency services
`;

// Disease database for fallback responses when Gemini API is not working
const diseaseDatabase = {
    "headache": {
        "description": "Pain in any region of the head.",
        "causes": "Stress, dehydration, lack of sleep, eye strain, sinusitis, or migraine.",
        "treatment": "Rest, hydration, over-the-counter pain relievers like acetaminophen or ibuprofen, and reducing screen time.",
        "when_to_see_doctor": "If headaches are severe, persistent, or accompanied by fever, confusion, stiff neck, or vision changes."
    },
    "cold": {
        "description": "A common viral infection that affects the upper respiratory tract.",
        "causes": "Rhinoviruses and other viruses that spread through air droplets or contact with infected surfaces.",
        "treatment": "Rest, hydration, over-the-counter cold medications, and saline nasal sprays.",
        "when_to_see_doctor": "If symptoms worsen after 10 days, or if you experience high fever, severe sinus pain, or breathing difficulties."
    },
    "fever": {
        "description": "An elevated body temperature, typically above 100.4°F (38°C).",
        "causes": "Infections (viral, bacterial, parasitic), inflammation, certain medications, vaccines, and some medical conditions.",
        "treatment": "Rest, hydration, over-the-counter fever reducers like acetaminophen or ibuprofen, and lightweight clothing.",
        "when_to_see_doctor": "If fever is above 103°F (39.4°C), lasts more than three days, or is accompanied by severe symptoms."
    }
};

// Initialize Gemini AI
let genAI, model;
try {
    if (GEMINI_API_KEY && GEMINI_API_KEY !== 'dummy_gemini_key') {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Gemini AI initialized successfully");
    } else {
        console.log("Gemini AI not initialized - using fallback responses only");
    }
} catch (error) {
    console.error("Error initializing Gemini AI:", error);
}

// Chat history to maintain context
const chatHistory = {};

// Helper function to get AI response
async function getAIResponse(userMessage, history) {
    try {
        if (!model) {
            throw new Error("Gemini AI model not initialized");
        }

        const chat = model.startChat({
            history: history || [],
            generationConfig: {
                temperature: 0.4,
                topK: 32,
                topP: 0.8,
                maxOutputTokens: 2048,
            },
        });

        const result = await chat.sendMessage(userMessage);
        const response = result.response;
        return response.text();
    } catch (error) {
        console.error("Error getting AI response:", error);
        return getResponseFromDiseaseDatabase(userMessage);
    }
}

// Function to get response from disease database as fallback
function getResponseFromDiseaseDatabase(userMessage) {
    const message = userMessage.toLowerCase();
    
    // Check for specific diseases in the message
    for (const [disease, info] of Object.entries(diseaseDatabase)) {
        if (message.includes(disease)) {
            return formatDiseaseResponse(disease, info);
        }
    }
    
    // Check for keywords like "what is", "how to treat", "causes of"
    if (message.includes("what is") || message.includes("tell me about")) {
        const diseaseMatches = Object.keys(diseaseDatabase).filter(disease => 
            message.includes(disease)
        );
        
        if (diseaseMatches.length > 0) {
            const disease = diseaseMatches[0];
            return formatDiseaseResponse(disease, diseaseDatabase[disease], "Here's information about ");
        }
    }
    
    // Default response if no matches
    return "I'm sorry, I don't have specific information on that medical condition. As a precaution, please consider consulting a healthcare professional for personalized advice.";
}

// Function to format disease response
function formatDiseaseResponse(disease, info, prefix = "") {
    return `${prefix}${disease.charAt(0).toUpperCase() + disease.slice(1)}:
Description: ${info.description}
Causes: ${info.causes}
Treatment: ${info.treatment}
When to See a Doctor: ${info.when_to_see_doctor}

Remember: This information is for educational purposes only and not a substitute for professional medical advice.`;
}

// Function to extract search terms for YouTube videos
function extractSearchTerms(userMessage, aiResponse) {
    const userMessageLower = userMessage.toLowerCase();
    
    // Check for health conditions
    const conditions = [
        "diabetes", "hypertension", "covid", "heart disease", "cancer", "stroke", 
        "asthma", "arthritis", "obesity", "depression", "anxiety", "headache", "cold", "fever"
    ];
    
    for (const condition of conditions) {
        if (userMessageLower.includes(condition)) {
            return `${condition} health information`;
        }
    }
    
    // Check for symptoms
    const symptoms = [
        "pain", "fatigue", "nausea", "vomiting", "cough", "rash"
    ];
    
    for (const symptom of symptoms) {
        if (userMessageLower.includes(symptom)) {
            return `managing ${symptom} symptoms`;
        }
    }
    
    // Default search term
    return "general health information";
}

// Function to search YouTube videos
async function searchYouTubeVideos(searchTerm) {
    try {
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'dummy_youtube_key') {
            console.log("YouTube API key not configured, returning empty video results");
            return [];
        }
        
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                part: 'snippet',
                maxResults: 3,
                q: searchTerm + " medical health information",
                type: 'video',
                key: YOUTUBE_API_KEY,
                videoEmbeddable: true,
                relevanceLanguage: 'en',
                safeSearch: 'strict'
            }
        });
        
        return response.data.items.map(item => ({
            id: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.medium.url,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`
        }));
    } catch (error) {
        console.error("Error searching YouTube videos:", error);
        return [];
    }
}

// Helper function for geocoding
async function getAddressFromCoordinates(lat, lng) {
    try {
        if (!MAPS_API_KEY || MAPS_API_KEY === 'dummy_maps_key') {
            return "123 Example Street, City, Country (API key not configured)";
        }
        
        const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json`, {
            params: {
                latlng: `${lat},${lng}`,
                key: MAPS_API_KEY
            }
        });
        
        if (response.data.results && response.data.results.length > 0) {
            return response.data.results[0].formatted_address;
        }
        return "Unknown location";
    } catch (error) {
        console.error("Error geocoding coordinates:", error);
        return "Error getting location";
    }
}

//===============================================
// CHATBOT API ROUTES
//===============================================

// API endpoint for chatbot responses
app.post('/api/chat', async (req, res) => {
    try {
        const { message, userId, location } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Create a unique userId if not provided
        const sessionId = userId || uuidv4();
        
        // Initialize chat history for new users
        if (!chatHistory[sessionId]) {
            chatHistory[sessionId] = [
                { role: "system", content: SYSTEM_PROMPT }
            ];
        }
        
        // Add user message to history
        chatHistory[sessionId].push({ role: "user", content: message });
        
        // Get response from AI (or fallback)
        const aiResponse = await getAIResponse(message, chatHistory[sessionId]);
        
        // Add AI response to history
        chatHistory[sessionId].push({ role: "model", content: aiResponse });
        
        // Maintain history limit (keep last 10 messages for performance)
        if (chatHistory[sessionId].length > 11) { // 1 system + 10 messages
            chatHistory[sessionId] = [
                chatHistory[sessionId][0], // Keep system prompt
                ...chatHistory[sessionId].slice(-10) // Keep last 10 messages
            ];
        }
        
        // Get related videos
        const searchTerm = extractSearchTerms(message, aiResponse);
        const videos = await searchYouTubeVideos(searchTerm);
        
        // Format and send response
        const responseData = {
            answer: aiResponse,
            relatedVideos: videos,
            sessionId: sessionId
        };
        
        // Handle location if provided
        if (location && location.latitude && location.longitude) {
            const addressInfo = await getAddressFromCoordinates(location.latitude, location.longitude);
            responseData.locationInfo = addressInfo;
        }
        
        res.json(responseData);
    } catch (error) {
        console.error("Error in chat endpoint:", error);
        res.status(500).json({ 
            error: 'An error occurred while processing your request',
            fallbackResponse: "I'm experiencing some technical difficulties. Please try again later or contact our support team for assistance."
        });
    }
});

// Additional endpoint for compatibility with the original backchatbot.js
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const userId = req.headers['user-id'] || 'default-user';
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        
        // Create session ID from userId
        const sessionId = userId;
        
        // Initialize chat history for new users
        if (!chatHistory[sessionId]) {
            chatHistory[sessionId] = [
                { role: "system", content: SYSTEM_PROMPT }
            ];
        }
        
        // Add user message to history
        chatHistory[sessionId].push({ role: "user", content: message });
        
        // Get response from AI (or fallback)
        const aiResponse = await getAIResponse(message, chatHistory[sessionId]);
        
        // Add AI response to history
        chatHistory[sessionId].push({ role: "model", content: aiResponse });
        
        // Maintain history limit
        if (chatHistory[sessionId].length > 11) {
            chatHistory[sessionId] = [
                chatHistory[sessionId][0],
                ...chatHistory[sessionId].slice(-10)
            ];
        }
        
        // Get related videos
        const searchTerm = extractSearchTerms(message, aiResponse);
        const videos = await searchYouTubeVideos(searchTerm);
        
        // Format and send response in the format expected by the original chatbot
        res.json({
            text: aiResponse,
            videos: videos.map(video => ({
                id: { videoId: video.id },
                snippet: {
                    title: video.title,
                    description: video.description,
                    thumbnails: {
                        medium: { url: video.thumbnail }
                    }
                }
            }))
        });
    } catch (error) {
        console.error("Error in chat endpoint:", error);
        res.status(500).json({ 
            text: 'Failed to process your request. Please try again later.'
        });
    }
});

// Maps API Key endpoint (for security)
app.get('/api/maps-key', (req, res) => {
    res.json({ key: MAPS_API_KEY });
});

// Emergency assistance endpoint
app.post('/emergency', async (req, res) => {
    try {
        const location = req.body.location;
        
        if (!location || !location.lat || !location.lng) {
            return res.status(400).json({ success: false, error: 'Invalid location data' });
        }
        
        // Get address from coordinates using Google Maps Geocoding API
        const address = await getAddressFromCoordinates(location.lat, location.lng);
        
        // Simulate emergency dispatch
        const eta = Math.floor(Math.random() * 10) + 5; // Random ETA between 5-15 minutes
        
        console.log(`Emergency request received for location: ${address}`);
        
        // Return success response
        res.json({
            success: true,
            eta: eta,
            address: address
        });
    } catch (error) {
        console.error('Error processing emergency request:', error);
        res.status(500).json({ success: false, error: 'Failed to process emergency request' });
    }
});

// Helper function to check if doctor is currently available
function isAvailableNow(availabilityString) {
  try {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'short' });
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    // Parse availability string (e.g., "Mon-Sat: 9:00 AM - 5:00 PM")
    const [days, hours] = availabilityString.split(': ');
    const [startDay, endDay] = days.split('-');
    const [startTime, endTime] = hours.split(' - ');
    
    // Check if current day is within working days
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const currentDayIndex = daysOfWeek.indexOf(day);
    const startDayIndex = daysOfWeek.indexOf(startDay);
    const endDayIndex = daysOfWeek.indexOf(endDay);
    
    if (currentDayIndex < startDayIndex || currentDayIndex > endDayIndex) {
      return false;
    }
    
    // Check if current time is within working hours
    const currentTime = new Date(`01/01/2000 ${time}`);
    const workStartTime = new Date(`01/01/2000 ${startTime}`);
    const workEndTime = new Date(`01/01/2000 ${endTime}`);
    
    return currentTime >= workStartTime && currentTime <= workEndTime;
  } catch (error) {
    console.error('Error checking availability:', error);
    return false;
  }
}

// Modified API endpoint to get list of doctors with better error handling
app.get('/api/doctors', (req, res) => {
  console.log('Received request for doctors list');
  
  if (!appointmentDb) {
    console.error('Database connection not established');
    return res.status(500).json({
      success: false,
      message: 'Database connection error'
    });
  }

  const queryTimeout = setTimeout(() => {
    console.error('Database query timeout');
    return res.status(500).json({
      success: false,
      message: 'Database query timeout'
    });
  }, 5000);

  appointmentDb.all(`
    SELECT 
      id,
      name,
      specialization,
      phone,
      address,
      languages,
      availability,
      created_at
    FROM doctors 
    ORDER BY name
  `, [], (err, rows) => {
    clearTimeout(queryTimeout);
    
    if (err) {
      console.error('Error fetching doctors:', err);
      return res.status(500).json({
        success: false,
        message: 'Error fetching doctors list',
        error: err.message
      });
    }

    console.log(`Found ${rows ? rows.length : 0} doctors in database`);

    if (!rows || rows.length === 0) {
      console.log('No doctors found in database');
      return res.json({
        success: true,
        doctors: []
      });
    }

    // Add additional information for each doctor
    const doctorsWithInfo = rows.map(doctor => ({
      ...doctor,
      availabilityStatus: isAvailableNow(doctor.availability) ? 'Available' : 'Not Available',
      rating: 4.5, // Default rating (in a real app, this would come from a ratings table)
      consultationFee: '₹500 - ₹1000' // Default fee range (in a real app, this would be stored in the database)
    }));

    console.log('Successfully processed doctors list');
    res.json({
      success: true,
      doctors: doctorsWithInfo
    });
  });
});

// Initialize database with sample doctors if needed
function initializeDoctorsDatabase() {
  appointmentDb.get('SELECT COUNT(*) as count FROM doctors', [], (err, result) => {
    if (err) {
      console.error('Error checking doctors count:', err);
      return;
    }

    if (result.count === 0) {
      console.log('No doctors found, adding sample doctors...');
      const sampleDoctors = [
        {
          name: 'John Smith',
          specialization: 'Cardiology',
          phone: '(123) 456-7890',
          address: '123 Main St, Medical Center, Floor 3',
          languages: 'English, Hindi',
          availability: 'Mon-Sat: 9:00 AM - 5:00 PM'
        },
        {
          name: 'Sarah Johnson',
          specialization: 'Pediatrics',
          phone: '(123) 456-7891',
          address: '456 Health Ave, Children\'s Hospital, Wing B',
          languages: 'English, Hindi, Marathi',
          availability: 'Mon-Fri: 10:00 AM - 6:00 PM'
        },
        {
          name: 'David Wilson',
          specialization: 'Orthopedics',
          phone: '(123) 456-7892',
          address: '789 Hospital Blvd, Orthopedic Center, Suite 201',
          languages: 'English, Hindi, Gujarati',
          availability: 'Mon-Sat: 9:00 AM - 5:00 PM'
        },
        {
          name: 'Emily Martinez',
          specialization: 'Dermatology',
          phone: '(123) 456-7893',
          address: '321 Skin Care Lane, Medical Plaza, Room 105',
          languages: 'English, Hindi, Tamil',
          availability: 'Mon-Fri: 11:00 AM - 7:00 PM'
        }
      ];

      const stmt = appointmentDb.prepare(`
        INSERT INTO doctors (name, specialization, phone, address, languages, availability)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let insertedCount = 0;
      sampleDoctors.forEach(doctor => {
        stmt.run(
          doctor.name,
          doctor.specialization,
          doctor.phone,
          doctor.address,
          doctor.languages,
          doctor.availability,
          (err) => {
            if (err) {
              console.error('Error adding doctor:', err);
            } else {
              insertedCount++;
              if (insertedCount === sampleDoctors.length) {
                console.log(`Successfully added ${insertedCount} sample doctors`);
                stmt.finalize();
              }
            }
          }
        );
      });
    } else {
      console.log(`Database already contains ${result.count} doctors`);
    }
  });
}

// Call initializeDoctorsDatabase when the server starts
initializeDoctorsDatabase();

// Start the server
app.listen(PORT, () => {
    console.log(`MediAssist server running on port ${PORT}`);
    console.log(`Chatbot accessible at: http://localhost:${PORT}/chatbot`);
    console.log(`Chatbot API endpoints available at:`);
    console.log(`  - http://localhost:${PORT}/api/chat (primary endpoint)`);
    console.log(`  - http://localhost:${PORT}/chat (compatibility endpoint)`);
    console.log(`  - http://localhost:${PORT}/emergency (emergency assistance endpoint)`);
    console.log(`  - http://localhost:${PORT}/api/maps-key (maps API endpoint)`);
    console.log('Chatbot successfully integrated with main backend!');
});