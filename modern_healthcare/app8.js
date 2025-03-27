const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Database setup
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    age INTEGER,
    gender TEXT
  )`);

  db.run(`CREATE TABLE health_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    record TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  db.run(`CREATE TABLE prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    prescription TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  db.run(`CREATE TABLE lab_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    report TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  db.run(`CREATE TABLE treatment_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER,
    title TEXT,
    description TEXT,
    FOREIGN KEY(patient_id) REFERENCES patients(id)
  )`);

  // Insert sample data
  db.run(`INSERT INTO patients (name, age, gender) VALUES ('John Doe', 30, 'Male')`);
  db.run(`INSERT INTO health_records (patient_id, record) VALUES (1, 'No known allergies')`);
  db.run(`INSERT INTO prescriptions (patient_id, prescription) VALUES (1, 'Ibuprofen 200mg')`);
  db.run(`INSERT INTO lab_reports (patient_id, report) VALUES (1, 'Blood test normal')`);
  db.run(`INSERT INTO treatment_plans (patient_id, title, description) VALUES (1, 'Physical Therapy', 'Twice weekly sessions for 3 months')`);
});

// API Endpoints - GET Methods
app.get('/api/patients', (req, res) => {
  db.all('SELECT * FROM patients', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ patients: rows });
  });
});

app.get('/api/health-records', (req, res) => {
  db.all('SELECT * FROM health_records', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ healthRecords: rows });
  });
});

app.get('/api/prescriptions', (req, res) => {
  db.all('SELECT * FROM prescriptions', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ prescriptions: rows });
  });
});

app.get('/api/lab-reports', (req, res) => {
  db.all('SELECT * FROM lab_reports', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ labReports: rows });
  });
});

app.get('/api/treatment-plans', (req, res) => {
  db.all('SELECT * FROM treatment_plans', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ treatmentPlans: rows });
  });
});

// API Endpoints - POST Methods
app.post('/api/patients', (req, res) => {
  const { name, age, gender } = req.body;
  
  if (!name || !age || !gender) {
    return res.status(400).json({ error: 'Name, age, and gender are required' });
  }
  
  const sql = 'INSERT INTO patients (name, age, gender) VALUES (?, ?, ?)';
  db.run(sql, [name, age, gender], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      message: 'Patient added successfully',
      id: this.lastID
    });
  });
});

app.post('/api/health-records', (req, res) => {
  const { patient_id, record } = req.body;
  
  if (!patient_id || !record) {
    return res.status(400).json({ error: 'Patient ID and record are required' });
  }
  
  const sql = 'INSERT INTO health_records (patient_id, record) VALUES (?, ?)';
  db.run(sql, [patient_id, record], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      message: 'Health record added successfully',
      id: this.lastID
    });
  });
});

app.post('/api/prescriptions', (req, res) => {
  const { patient_id, prescription } = req.body;
  
  if (!patient_id || !prescription) {
    return res.status(400).json({ error: 'Patient ID and prescription are required' });
  }
  
  const sql = 'INSERT INTO prescriptions (patient_id, prescription) VALUES (?, ?)';
  db.run(sql, [patient_id, prescription], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      message: 'Prescription added successfully',
      id: this.lastID
    });
  });
});

app.post('/api/lab-reports', (req, res) => {
  const { patient_id, report } = req.body;
  
  if (!patient_id || !report) {
    return res.status(400).json({ error: 'Patient ID and report are required' });
  }
  
  const sql = 'INSERT INTO lab_reports (patient_id, report) VALUES (?, ?)';
  db.run(sql, [patient_id, report], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      message: 'Lab report added successfully',
      id: this.lastID
    });
  });
});

app.post('/api/treatment-plans', (req, res) => {
  const { patient_id, title, description } = req.body;
  
  if (!patient_id || !title || !description) {
    return res.status(400).json({ error: 'Patient ID, title, and description are required' });
  }
  
  const sql = 'INSERT INTO treatment_plans (patient_id, title, description) VALUES (?, ?, ?)';
  db.run(sql, [patient_id, title, description], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.status(201).json({
      message: 'Treatment plan added successfully',
      id: this.lastID
    });
  });
});

// Add a GET endpoint for treatment plans by patient ID
app.get('/api/treatment-plans/:patientId', (req, res) => {
  const patientId = req.params.patientId;
  
  db.all('SELECT * FROM treatment_plans WHERE patient_id = ?', [patientId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ treatmentPlans: rows });
  });
});

// Add a GET endpoint for health records by patient ID
app.get('/api/health-records/:patientId', (req, res) => {
  const patientId = req.params.patientId;
  
  db.all('SELECT * FROM health_records WHERE patient_id = ?', [patientId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ healthRecords: rows });
  });
});

// Add a GET endpoint for prescriptions by patient ID
app.get('/api/prescriptions/:patientId', (req, res) => {
  const patientId = req.params.patientId;
  
  db.all('SELECT * FROM prescriptions WHERE patient_id = ?', [patientId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ prescriptions: rows });
  });
});

// Add a GET endpoint for lab reports by patient ID
app.get('/api/lab-reports/:patientId', (req, res) => {
  const patientId = req.params.patientId;
  
  db.all('SELECT * FROM lab_reports WHERE patient_id = ?', [patientId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ labReports: rows });
  });
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'mainfile.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});