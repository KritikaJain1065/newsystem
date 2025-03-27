// Integrated Doctor Appointment System - app.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Database setup
let db;

async function initializeDatabase() {
  try {
    // Open the database
    db = await open({
      filename: path.join(__dirname, 'database.sqlite'),
      driver: sqlite3.Database
    });

    console.log('Connected to SQLite database');

    // Create tables if they don't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        specialization TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.exec(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fullName TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        doctorId INTEGER NOT NULL,
        reason TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctorId) REFERENCES doctors (id)
      );
    `);

    // Check if we have doctors in the database
    const doctorCount = await db.get('SELECT COUNT(*) as count FROM doctors');
    
    // Insert sample doctors if no doctors exist
    if (doctorCount.count === 0) {
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

      for (const doctor of sampleDoctors) {
        await db.run(
          'INSERT INTO doctors (name, specialization, phone, address) VALUES (?, ?, ?, ?)',
          [doctor.name, doctor.specialization, doctor.phone, doctor.address]
        );
      }
      
      console.log('Sample doctors added to the database');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

// API Routes

// Get all doctors
app.get('/api/doctors', async (req, res) => {
  try {
    const doctors = await db.all('SELECT * FROM doctors ORDER BY name');
    res.json(doctors);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Error fetching doctors' });
  }
});

// Get a specific doctor
app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doctor = await db.get('SELECT * FROM doctors WHERE id = ?', req.params.id);
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    res.json(doctor);
  } catch (error) {
    console.error('Error fetching doctor:', error);
    res.status(500).json({ message: 'Error fetching doctor details' });
  }
});

// Create a new appointment
app.post('/api/appointments', async (req, res) => {
  const { fullName, email, phone, date, time, doctorId, reason } = req.body;
  
  // Validate required fields
  if (!fullName || !email || !phone || !date || !time || !doctorId || !reason) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  try {
    // Check if doctor exists
    const doctor = await db.get('SELECT id FROM doctors WHERE id = ?', doctorId);
    
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor not found' });
    }
    
    // Check if doctor is available at the requested time
    const existingAppointment = await db.get(
      'SELECT id FROM appointments WHERE doctorId = ? AND date = ? AND time = ?',
      [doctorId, date, time]
    );
    
    if (existingAppointment) {
      return res.status(409).json({ 
        message: 'This time slot is already booked. Please select a different time.' 
      });
    }
    
    // Create the appointment
    const result = await db.run(
      `INSERT INTO appointments 
      (fullName, email, phone, date, time, doctorId, reason) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [fullName, email, phone, date, time, doctorId, reason]
    );
    
    // Return the created appointment
    const appointment = await db.get('SELECT * FROM appointments WHERE id = ?', result.lastID);
    
    res.status(201).json({
      message: 'Appointment created successfully',
      appointment
    });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Error creating appointment' });
  }
});

// Get all appointments
app.get('/api/appointments', async (req, res) => {
  try {
    const appointments = await db.all(`
      SELECT a.*, d.name as doctorName, d.specialization
      FROM appointments a
      JOIN doctors d ON a.doctorId = d.id
      ORDER BY a.date, a.time
    `);
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
});

// Get appointments for a specific doctor
app.get('/api/doctors/:id/appointments', async (req, res) => {
  try {
    const appointments = await db.all(
      `SELECT * FROM appointments WHERE doctorId = ? ORDER BY date, time`,
      req.params.id
    );
    
    res.json(appointments);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Error fetching doctor appointments' });
  }
});

// Update appointment status
app.patch('/api/appointments/:id', async (req, res) => {
  const { status } = req.body;
  
  if (!status || !['pending', 'confirmed', 'cancelled', 'completed'].includes(status)) {
    return res.status(400).json({ message: 'Valid status is required' });
  }
  
  try {
    const appointment = await db.get('SELECT id FROM appointments WHERE id = ?', req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    await db.run(
      'UPDATE appointments SET status = ? WHERE id = ?',
      [status, req.params.id]
    );
    
    const updatedAppointment = await db.get('SELECT * FROM appointments WHERE id = ?', req.params.id);
    
    res.json({
      message: 'Appointment updated successfully',
      appointment: updatedAppointment
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Error updating appointment' });
  }
});

// Delete an appointment
app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await db.get('SELECT id FROM appointments WHERE id = ?', req.params.id);
    
    if (!appointment) {
      return res.status(404).json({ message: 'Appointment not found' });
    }
    
    await db.run('DELETE FROM appointments WHERE id = ?', req.params.id);
    
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ message: 'Error cancelling appointment' });
  }
});

// Serve the appointment booking HTML file from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve the HTML file on the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});