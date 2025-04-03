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
require('dotenv').config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// API Keys from environment variables
const MAPS_API_KEY = process.env.MAPS_API_KEY;

// Log API key status without exiting the server
console.log('Checking API keys...');
if (!MAPS_API_KEY) {
    console.warn('MAPS_API_KEY is missing - some location-based features may not work properly');
    console.warn('To enable all features, get a Maps API key from: https://console.cloud.google.com/google/maps-apis/credentials');
    console.warn('Then add it to your .env file as MAPS_API_KEY=your_key_here');
} else {
    console.log('MAPS_API_KEY is configured properly!');
}

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files - simplified configuration
app.use(express.static(path.join(__dirname, '../frontend')));

// Root route handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Catch-all route for SPA-like behavior
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

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
const usersDb = new sqlite3.Database(path.join(__dirname, '../new_users.db'), (err) => {
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
const recruitmentDb = new sqlite3.Database(path.join(__dirname, '../mediassist.db'), (err) => {
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

// 2. Doctor Appointment Database
const appointmentDb = new sqlite3.Database(path.join(__dirname, '../appointment_system.db'), (err) => {
  if (err) {
    console.error('Error opening appointment database', err.message);
  } else {
    console.log('Connected to the appointment SQLite database');
    
    // Create doctors table with proper schema and indexes
    appointmentDb.serialize(() => {
      // Create doctors table
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
      });

      // Create index on specialization for better query performance
      appointmentDb.run(`
        CREATE INDEX IF NOT EXISTS idx_doctors_specialization 
        ON doctors(specialization)
      `, (err) => {
        if (err) {
          console.error('Error creating specialization index:', err.message);
        }
      });

      // Initialize sample doctors if none exist
      appointmentDb.get('SELECT COUNT(*) as count FROM doctors', [], (err, result) => {
        if (err) {
          console.error('Error checking doctors count:', err.message);
          return;
        }

        if (result.count === 0) {
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
              availability: 'Mon-Sat: 8:00 AM - 4:00 PM'
            },
            {
              name: 'Emily Martinez',
              specialization: 'Dermatology',
              phone: '(123) 456-7893',
              address: '321 Skin Care Lane, Medical Plaza, Room 105',
              languages: 'English, Hindi, Tamil',
              availability: 'Mon-Fri: 9:00 AM - 5:00 PM'
            }
          ];

          // Use transaction for inserting sample doctors
          appointmentDb.run('BEGIN TRANSACTION');

          const stmt = appointmentDb.prepare(`
            INSERT INTO doctors (name, specialization, phone, address, languages, availability) 
            VALUES (?, ?, ?, ?, ?, ?)`
          );

          let insertedCount = 0;
          let hasError = false;

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
                  console.error('Error adding doctor:', err.message);
                  hasError = true;
                } else {
                  insertedCount++;
                }

                if (insertedCount === sampleDoctors.length) {
                  stmt.finalize();
                  if (hasError) {
                    appointmentDb.run('ROLLBACK', (err) => {
                      if (err) console.error('Error rolling back transaction:', err.message);
                      else console.log('Transaction rolled back due to errors');
                    });
                  } else {
                    appointmentDb.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err.message);
                        appointmentDb.run('ROLLBACK');
                      } else {
                        console.log(`Successfully added ${insertedCount} sample doctors`);
                      }
                    });
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

// Modified API endpoint to get list of doctors with consistent response format
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

// Add API endpoint to get doctors by specialization
app.get('/api/doctors/specialization/:specialization', (req, res) => {
  const specialization = req.params.specialization;
  appointmentDb.all('SELECT * FROM doctors WHERE specialization = ? ORDER BY name', [specialization], (err, rows) => {
    if (err) {
      console.error('Error fetching doctors by specialization:', err);
      return res.status(500).json({ 
        message: 'Error fetching doctors list',
        error: err.message
      });
    }
    // Return the array directly, consistent with app1.js
    res.json(rows);
  });
});

// Add API endpoint to get doctor by ID
app.get('/api/doctors/:id', (req, res) => {
  const doctorId = req.params.id;
  appointmentDb.get('SELECT * FROM doctors WHERE id = ?', [doctorId], (err, row) => {
    if (err) {
      console.error('Error fetching doctor:', err);
      return res.status(500).json({ 
        message: 'Error fetching doctor details',
        error: err.message
      });
    }
    if (!row) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }
    // Return the doctor object directly, consistent with app1.js
    res.json(row);
  });
});

// 5. Telehealth Database
const telehealthDb = new sqlite3.Database(path.join(__dirname, '../telehealth.db'), (err) => {
  if (err) {
    console.error('Error opening telehealth database', err.message);
  } else {
    console.log('Connected to the telehealth SQLite database');
    
    // Create facilities table for Indian healthcare facilities
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS facilities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        emergency BOOLEAN NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating facilities table:', err.message);
      } else {
        console.log('Facilities table initialized');
        
        // Add sample Indian healthcare facilities
        const sampleFacilities = [
          {
            id: 'f001',
            name: "AIIMS Delhi",
            type: "hospital",
            address: "Sri Aurobindo Marg, Ansari Nagar, New Delhi, Delhi 110029",
            phone: "011-2658-8500",
            emergency: true,
            latitude: 28.5672,
            longitude: 77.2100,
            city: "New Delhi",
            state: "Delhi"
          },
          {
            id: 'f002',
            name: "Tata Memorial Hospital",
            type: "hospital",
            address: "Dr. E Borges Road, Parel, Mumbai, Maharashtra 400012",
            phone: "022-2417-7000",
            emergency: true,
            latitude: 18.9937,
            longitude: 72.8429,
            city: "Mumbai",
            state: "Maharashtra"
          },
          {
            id: 'f003',
            name: "Apollo Pharmacy",
            type: "pharmacy",
            address: "MG Road, Bangalore, Karnataka 560001",
            phone: "080-2558-3911",
            emergency: false,
            latitude: 12.9716,
            longitude: 77.5946,
            city: "Bangalore",
            state: "Karnataka"
          },
          {
            id: 'f004',
            name: "Medanta - The Medicity",
            type: "hospital",
            address: "CH Baktawar Singh Rd, Medicity, Gurugram, Haryana 122001",
            phone: "0124-4141-414",
            emergency: true,
            latitude: 28.4397,
            longitude: 77.0401,
            city: "Gurugram",
            state: "Haryana"
          },
          {
            id: 'f005',
            name: "Fortis Healthcare",
            type: "clinic",
            address: "Sector 62, Noida, Uttar Pradesh 201301",
            phone: "0120-4300-222",
            emergency: true,
            latitude: 28.6139,
            longitude: 77.3592,
            city: "Noida",
            state: "Uttar Pradesh"
          }
        ];

        // Insert sample facilities
        const stmt = telehealthDb.prepare(`
          INSERT OR REPLACE INTO facilities 
          (id, name, type, address, phone, emergency, latitude, longitude, city, state) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        );

        sampleFacilities.forEach(facility => {
          stmt.run(
            facility.id,
            facility.name,
            facility.type,
            facility.address,
            facility.phone,
            facility.emergency ? 1 : 0,
            facility.latitude,
            facility.longitude,
            facility.city,
            facility.state
          );
        });

        stmt.finalize();
      }
    });

    // Create mobile_clinics table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS mobile_clinics (
        id TEXT PRIMARY KEY,
        location TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating mobile_clinics table:', err.message);
      } else {
        console.log('Mobile clinics table initialized');
        
        // Add sample mobile clinic data
        const sampleMobileClinics = [
          {
            id: 'mc001',
            location: 'Dharavi',
            date: '2025-03-25',
            status: 'scheduled',
            city: 'Mumbai',
            state: 'Maharashtra'
          },
          {
            id: 'mc002',
            location: 'Chandni Chowk',
            date: '2025-03-27',
            status: 'in-transit',
            city: 'Delhi',
            state: 'Delhi'
          }
        ];

        const stmt = telehealthDb.prepare(`
          INSERT OR REPLACE INTO mobile_clinics 
          (id, location, date, status, city, state) 
          VALUES (?, ?, ?, ?, ?, ?)`
        );

        sampleMobileClinics.forEach(clinic => {
          stmt.run(
            clinic.id,
            clinic.location,
            clinic.date,
            clinic.status,
            clinic.city,
            clinic.state
          );
        });

        stmt.finalize();
      }
    });

    // Create health_campaigns table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS health_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        description TEXT NOT NULL,
        target_area TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Error creating health_campaigns table:', err.message);
      } else {
        console.log('Health campaigns table initialized');
        
        // Add sample health campaign data
        const sampleCampaigns = [
          {
            id: 'c001',
            name: "Pulse Polio Immunization",
            type: "vaccination",
            start_date: "2025-03-28",
            end_date: "2025-04-28",
            description: "National immunization drive for polio prevention",
            target_area: "Pan India"
          },
          {
            id: 'c002',
            name: "Ayushman Bharat Health Camp",
            type: "health_checkup",
            start_date: "2025-04-15",
            end_date: "2025-05-15",
            description: "Free health checkup and awareness camp",
            target_area: "Rural India"
          }
        ];

        const stmt = telehealthDb.prepare(`
          INSERT OR REPLACE INTO health_campaigns 
          (id, name, type, start_date, end_date, description, target_area) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        );

        sampleCampaigns.forEach(campaign => {
          stmt.run(
            campaign.id,
            campaign.name,
            campaign.type,
            campaign.start_date,
            campaign.end_date,
            campaign.description,
            campaign.target_area
          );
        });

        stmt.finalize();
      }
    });

    // Create emergency_requests table
    telehealthDb.run(`
      CREATE TABLE IF NOT EXISTS emergency_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        emergency_id TEXT UNIQUE,
        location TEXT NOT NULL,
        coordinates TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'dispatched',
        nearest_service TEXT,
        estimated_response TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating emergency_requests table:', err.message);
      } else {
        console.log('Emergency requests table initialized');
      }
    });
  }
});

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
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../frontend/main_websitepage.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '../frontend/sign_up.html')));
app.get('/signin', (req, res) => res.sendFile(path.join(__dirname, '../frontend/sign_in.html')));
app.get('/main', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, '../frontend/main_websitepage.html')));

// Splash and onboarding routes
app.get('/splash', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/splash.html'));
});

app.get('/onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/advertisment_all_login_Connected.html'));
});

// Emergency service route - accessible without login
app.get('/emergency', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/final_guestpage.html'));
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
  res.sendFile(path.join(__dirname, '../frontend/recruitement_page.html'));
});

// Appointment booking routes
app.get('/book-appointment', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/book_appointment.html'));
});

app.get('/doctor-appointment', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/book_appointment.html'));
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

// Helper function to find nearest service
function findNearestService(coordinates) {
  // For now, return a default service
  // In a real application, this would calculate the nearest service based on coordinates
  return "AIIMS Delhi";
}

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
            emergency_id, location, coordinates, nearest_service, estimated_response
        ) VALUES (?, ?, ?, ?, ?)`,
        [
            emergencyId,
            location,
            coordinates ? JSON.stringify(coordinates) : null,
            nearestService,
            estimatedResponse
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

// Get emergency request status
app.get('/api/emergency-status/:emergencyId', (req, res) => {
    const { emergencyId } = req.params;

    telehealthDb.get(
        'SELECT * FROM emergency_requests WHERE emergency_id = ?',
        [emergencyId],
        (err, request) => {
            if (err) {
                console.error('Error fetching emergency status:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching emergency status'
                });
            }

            if (!request) {
                return res.status(404).json({
                    success: false,
                    message: 'Emergency request not found'
                });
            }

            res.json({
                success: true,
                status: request.status,
                nearestService: request.nearest_service,
                estimatedResponse: request.estimated_response,
                timestamp: request.timestamp
            });
        }
    );
});

// API for mobile clinic requests
app.post('/api/request-mobile-clinic', (req, res) => {
    const { location, serviceType, date, city, state } = req.body;
    
    const id = 'mc' + Date.now();
    
    telehealthDb.run(
        `INSERT INTO mobile_clinics (id, location, date, status, city, state) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, location, date, 'scheduled', city, state],
        function(err) {
            if (err) {
                console.error('Error creating mobile clinic request:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error processing request'
                });
            }
            
            res.json({
                success: true,
                trackingId: id,
                estimatedArrival: date
            });
        }
    );
});

// API for nearby facilities
app.get('/api/nearby-facilities', (req, res) => {
    const { location, type, radius } = req.query;
    
    let query = 'SELECT * FROM facilities';
    const params = [];
    
    if (type && type !== 'all') {
        query += ' WHERE type = ?';
        params.push(type);
    }
    
    telehealthDb.all(query, params, (err, facilities) => {
        if (err) {
            console.error('Error fetching facilities:', err);
            return res.status(500).json({
                success: false,
                message: 'Error fetching facilities'
            });
        }
        
        res.json({
            success: true,
            location: location,
            radius: radius,
            facilities: facilities
        });
    });
});

//===============================================
// HEALTH CAMPAIGNS API
//===============================================

// Indian Health Campaigns API
app.get('/api/health-campaigns', (req, res) => {
    telehealthDb.all('SELECT * FROM health_campaigns ORDER BY start_date', [], (err, campaigns) => {
        if (err) {
            console.error('Error fetching campaigns:', err);
            return res.status(500).json({
                success: false,
                message: 'Error fetching campaigns'
            });
        }
        
        res.json({
            success: true,
            campaigns: campaigns
        });
    });
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
  res.sendFile(path.join(__dirname, '../frontend/telehealth_services.html'));
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
// APPOINTMENT BOOKING API
//===============================================

// Create a new appointment
app.post('/api/appointments', (req, res) => {
  const { fullName, email, phone, date, time, doctorId, reason } = req.body;
  
  // Validate required fields
  if (!fullName || !email || !phone || !date || !time || !doctorId || !reason) {
    return res.status(400).json({
      message: 'All fields are required'
    });
  }

  // Check if doctor exists
  appointmentDb.get('SELECT id FROM doctors WHERE id = ?', [doctorId], (err, doctor) => {
    if (err) {
      console.error('Error checking doctor:', err);
      return res.status(500).json({
        message: 'Database error'
      });
    }

    if (!doctor) {
      return res.status(404).json({
        message: 'Doctor not found'
      });
    }

    // Check if appointment slot is available
    appointmentDb.get(
      'SELECT id FROM appointments WHERE doctorId = ? AND date = ? AND time = ? AND status != "cancelled"',
      [doctorId, date, time],
      (err, existingAppointment) => {
        if (err) {
          console.error('Error checking appointment availability:', err);
          return res.status(500).json({
            message: 'Error checking appointment availability'
          });
        }

        if (existingAppointment) {
          return res.status(409).json({
            message: 'This time slot is already booked. Please select a different time.'
          });
        }

        // Create new appointment
        appointmentDb.run(
          `INSERT INTO appointments (
            fullName, email, phone, date, time, doctorId, reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [fullName, email, phone, date, time, doctorId, reason],
          function(err) {
            if (err) {
              console.error('Error booking appointment:', err);
              return res.status(500).json({
                message: 'Error creating appointment'
              });
            }

            // Get the created appointment
            appointmentDb.get('SELECT * FROM appointments WHERE id = ?', [this.lastID], (err, appointment) => {
              if (err) {
                console.error('Error retrieving created appointment:', err);
                return res.status(201).json({
                  message: 'Appointment created successfully',
                  appointmentId: this.lastID
                });
              }

              res.status(201).json({
                message: 'Appointment created successfully',
                appointment
              });
            });
          }
        );
      }
    );
  });
});

// Get all appointments
app.get('/api/appointments', (req, res) => {
  appointmentDb.all(
    `SELECT a.*, d.name as doctorName, d.specialization 
     FROM appointments a
     JOIN doctors d ON a.doctorId = d.id
     ORDER BY a.date, a.time`,
    (err, rows) => {
      if (err) {
        console.error('Error fetching appointments:', err);
        return res.status(500).json({
          message: 'Error fetching appointments'
        });
      }
      
      res.json(rows);
    }
  );
});

// Get appointments for a specific doctor
app.get('/api/doctors/:id/appointments', (req, res) => {
  const doctorId = req.params.id;
  
  appointmentDb.all(
    `SELECT * FROM appointments 
     WHERE doctorId = ?
     ORDER BY date, time`,
    [doctorId],
    (err, rows) => {
      if (err) {
        console.error('Error fetching doctor appointments:', err);
        return res.status(500).json({
          message: 'Error fetching doctor appointments'
        });
      }
      
      res.json(rows);
    }
  );
});

// Update appointment status
app.patch('/api/appointments/:id', (req, res) => {
  const appointmentId = req.params.id;
  const { status } = req.body;
  
  if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({
      message: 'Valid status is required'
    });
  }
  
  appointmentDb.get('SELECT id FROM appointments WHERE id = ?', [appointmentId], (err, appointment) => {
    if (err) {
      console.error('Error checking appointment:', err);
      return res.status(500).json({
        message: 'Database error'
      });
    }

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }
    
    appointmentDb.run(
      'UPDATE appointments SET status = ? WHERE id = ?',
      [status, appointmentId],
      function(err) {
        if (err) {
          console.error('Error updating appointment status:', err);
          return res.status(500).json({
            message: 'Error updating appointment'
          });
        }
        
        appointmentDb.get('SELECT * FROM appointments WHERE id = ?', [appointmentId], (err, updatedAppointment) => {
          if (err) {
            console.error('Error retrieving updated appointment:', err);
            return res.status(200).json({
              message: 'Appointment updated successfully'
            });
          }
          
          res.json({
            message: 'Appointment updated successfully',
            appointment: updatedAppointment
          });
        });
      }
    );
  });
});

// Delete an appointment
app.delete('/api/appointments/:id', (req, res) => {
  const appointmentId = req.params.id;
  
  appointmentDb.get('SELECT id FROM appointments WHERE id = ?', [appointmentId], (err, appointment) => {
    if (err) {
      console.error('Error checking appointment:', err);
      return res.status(500).json({
        message: 'Database error'
      });
    }

    if (!appointment) {
      return res.status(404).json({
        message: 'Appointment not found'
      });
    }
    
    appointmentDb.run('DELETE FROM appointments WHERE id = ?', [appointmentId], function(err) {
      if (err) {
        console.error('Error deleting appointment:', err);
        return res.status(500).json({
          message: 'Error cancelling appointment'
        });
      }
      
      res.json({
        message: 'Appointment cancelled successfully'
      });
    });
  });
});

//===============================================
// START SERVER
//===============================================

// Start the server
app.listen(PORT, () => {
  console.log(`MediAssist server running on port ${PORT}`);
}); 