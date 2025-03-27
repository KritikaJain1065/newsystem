// Doctor Appointment System Backend
const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve the HTML file on the root URL - using book_appointment.html
app.get('/', (req, res) => {
  res.sendFile(path.resolve('c:/newsystem/frontend/book_appointment.html'));
});

// Additional routes to serve the same file
app.get('/book-appointment', (req, res) => {
  res.sendFile(path.resolve('c:/newsystem/frontend/book_appointment.html'));
});

app.get('/doctor-appointment', (req, res) => {
  res.sendFile(path.resolve('c:/newsystem/frontend/book_appointment.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
}); 