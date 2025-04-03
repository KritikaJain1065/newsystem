const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const bodyParser = require('body-parser');
const session = require('express-session');

const app = express();
const url="https://medi-assist.onrender.com"

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

// Initialize SQLite Database with a new name
const db = new sqlite3.Database('./new_users.db', (err) => {
    if (err) console.error('Database connection error:', err.message);
    else {
        console.log('Connected to SQLite database');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Authentication Middleware
const isAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect('/signin');
};

// Serve Static HTML Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'sign_up.html')));
app.get('/signin', (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'sign_in.html')));
app.get('/main', isAuthenticated, (req, res) => res.sendFile(path.join(__dirname, 'frontend', 'main_websitepage.html')));

// User Dashboard (Protected)
app.get('/dashboard', isAuthenticated, (req, res) => {
    res.send(`
        <h1>Welcome ${req.session.user.username}!</h1>
        <p>Email: ${req.session.user.email}</p>
        <a href="/logout">Logout</a>
    `);
});

// User Registration (Sign Up)
app.post('/api/signup', (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ success: false, message: 'All fields are required' });

    db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });
        if (user) return res.status(409).json({ success: false, message: 'Username or email already exists' });

        bcrypt.hash(password, 10, (err, hash) => {
            if (err) return res.status(500).json({ success: false, message: 'Error hashing password' });

            db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', 
                [username, email, hash], function(err) {
                    if (err) return res.status(500).json({ success: false, message: 'Error creating user' });

                    res.status(201).json({ 
                        success: true, 
                        message: 'User registered successfully',
                        userId: this.lastID
                    });
            });
        });
    });
});

// User Login (Sign In)
app.post('/api/signin', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password are required' });

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
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

// Routes
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

// API for emergency service
app.post('/api/emergency-connect', (req, res) => {
    const { location } = req.body;
    
    // In a real application, this would connect to emergency services database
    // This is a simulation for demonstration
    const emergencyResponse = {
        success: true,
        nearestService: "City Central Hospital",
        estimatedResponse: "8-10 minutes",
        emergencyId: "EM-" + Math.floor(Math.random() * 10000)
    };
    
    // Simulate processing time
    setTimeout(() => {
        res.json(emergencyResponse);
    }, 1000);
});

// API for mobile clinic requests
app.post('/api/request-mobile-clinic', (req, res) => {
    const { location, serviceType, date } = req.body;
    
    const response = {
        success: true,
        trackingId: "MC-" + Math.floor(Math.random() * 10000),
        estimatedArrival: date
    };
    
    setTimeout(() => {
        res.json(response);
    }, 800);
});

// API for nearby facilities
app.get('/api/nearby-facilities', (req, res) => {
    const { location, type, radius } = req.query;
    
    // Mock data for facilities
    const allFacilities = [
        { 
            name: "Community Health Center", 
            type: "health-center", 
            address: "123 Main St, Cityville", 
            distance: "0.8 km", 
            phone: "555-1234", 
            emergency: true 
        },
        { 
            name: "City Hospital", 
            type: "hospital", 
            address: "456 Oak Ave, Cityville", 
            distance: "2.3 km", 
            phone: "555-5678", 
            emergency: true 
        },
        { 
            name: "MediPlus Pharmacy", 
            type: "pharmacy", 
            address: "789 Elm St, Cityville", 
            distance: "0.5 km", 
            phone: "555-9012", 
            emergency: false 
        },
        { 
            name: "Family Care Clinic", 
            type: "clinic", 
            address: "321 Pine Rd, Cityville", 
            distance: "1.7 km", 
            phone: "555-3456", 
            emergency: false 
        }
    ];
    
    // Filter facilities based on type
    let facilities = allFacilities;
    if (type && type !== 'all') {
        facilities = allFacilities.filter(f => f.type === type);
    }
    
    const response = {
        success: true,
        location: location,
        radius: radius,
        facilities: facilities
    };
    
    setTimeout(() => {
        res.json(response);
    }, 1200);
});

// Contact form API
app.post('/api/contact', (req, res) => {
    const { name, email, phone, message } = req.body;
    
    // In a real application, you would save this to a database
    // and/or send an email notification
    
    const response = {
        success: true,
        message: "Thank you for your message. We will contact you shortly."
    };
    
    setTimeout(() => {
        res.json(response);
    }, 1000);
});

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
            shortDescription: "Aims to provide accessible, affordable, and quality healthcare to rural areas with special focus on the states with weak health indicators.",
            fullDescription: "The National Health Mission encompasses the National Rural Health Mission and National Urban Health Mission. It aims to provide universal access to equitable, affordable and quality health care services.",
            eligibility: "All Indian citizens with special focus on vulnerable groups",
            benefits: ["Improved healthcare facilities", "Reduced disease burden", "Strengthened public health systems", "Focus on Reproductive, Maternal, Newborn, Child and Adolescent Health (RMNCH+A) services"],
            applicationProcess: "Access services through your nearest public health facility.",
            officialWebsite: "https://nhm.gov.in/",
            contactNumber: "011-23061360",
            lastUpdated: "2023-06-20"
        },
        {
            id: 3,
            title: "Pradhan Mantri Surakshit Matritva Abhiyan (PMSMA)",
            shortDescription: "Provides free antenatal check-ups for pregnant women on the 9th of every month.",
            fullDescription: "PMSMA provides fixed-day assured, comprehensive and quality antenatal care to pregnant women on the 9th of every month to ensure safe pregnancy.",
            eligibility: "All pregnant women in their second and third trimesters",
            benefits: ["Free antenatal check-ups", "Required tests", "Counseling by gynecologists/physicians"],
            applicationProcess: "Visit your nearest health center or government hospital on the 9th of every month.",
            officialWebsite: "https://pmsma.nhp.gov.in/",
            contactNumber: "1800-180-1104",
            lastUpdated: "2023-04-10"
        },
        {
            id: 4,
            title: "Mission Indradhanush",
            shortDescription: "Aims to immunize all children under the age of 2 years and pregnant women against preventable diseases.",
            fullDescription: "Mission Indradhanush aims to immunize all children under the age of 2 years and pregnant women against vaccine preventable diseases. The program is a key initiative to strengthen immunization coverage.",
            eligibility: "All children under 2 years and pregnant women",
            benefits: ["Protection against 12 Vaccine-Preventable Diseases", "Free immunization services", "Regular immunization camps"],
            applicationProcess: "Visit your nearest health center, Anganwadi Center, or government hospital during immunization drives.",
            officialWebsite: "https://nhm.gov.in/index1.php?lang=1&level=2&sublinkid=808&lid=220",
            contactNumber: "011-23061360",
            lastUpdated: "2023-07-05"
        },
        {
            id: 5,
            title: "Rashtriya Swasthya Bima Yojana (RSBY)",
            shortDescription: "A health insurance scheme for BPL families with coverage up to ₹30,000 per family per annum.",
            fullDescription: "RSBY is a health insurance scheme for the Below Poverty Line (BPL) families with the aim to reduce out-of-pocket expenditure on healthcare and increase access to health services.",
            eligibility: "Below Poverty Line (BPL) families",
            benefits: ["Health insurance coverage up to ₹30,000 per family per annum", "Cashless treatment at network hospitals", "Smart card for identification and cashless transactions"],
            applicationProcess: "Apply through your local government authorities or district nodal agency.",
            officialWebsite: "https://www.india.gov.in/rashtriya-swasthya-bima-yojana",
            contactNumber: "1800-180-1104",
            lastUpdated: "2023-03-25"
        },
        {
            id: 6,
            title: "National Digital Health Mission (NDHM)",
            shortDescription: "Creates a digital health ecosystem with unique Health IDs for all citizens.",
            fullDescription: "National Digital Health Mission aims to develop the backbone necessary to support the integrated digital health infrastructure of the country. It will bridge existing gaps in healthcare delivery and create a digital health ecosystem.",
            eligibility: "All Indian citizens",
            benefits: ["Unique Health ID", "Personal health records", "Easy access to health services", "Digital health solutions"],
            applicationProcess: "Register online through the ABDM (Ayushman Bharat Digital Mission) portal or mobile app.",
            officialWebsite: "https://abdm.gov.in/",
            applicationLink: "https://healthid.ndhm.gov.in/",
            contactNumber: "1800-11-4477",
            lastUpdated: "2023-08-01"
        },
        {
            id: 7,
            title: "Fit India Movement",
            shortDescription: "A nationwide campaign encouraging people to include fitness activities in their daily lives.",
            fullDescription: "Fit India Movement is a nation-wide campaign that aims at encouraging people to include physical activities and sports in their everyday lives to promote wellness and good health.",
            eligibility: "All Indian citizens",
            benefits: ["Improved physical fitness", "Better mental health", "Community fitness activities", "Fitness certification programs"],
            applicationProcess: "Participate in Fit India events through schools, colleges, or community centers.",
            officialWebsite: "https://fitindia.gov.in/",
            contactNumber: "011-23381831",
            lastUpdated: "2023-07-15"
        }
    ];
    
    // Support filtering by campaign ID
    if (req.query.id) {
        const campaignId = parseInt(req.query.id);
        const campaign = campaigns.find(c => c.id === campaignId);
        
        if (campaign) {
            return res.json({ success: true, campaign });
        } else {
            return res.status(404).json({ success: false, message: "Campaign not found" });
        }
    }
    
    // Support search functionality
    if (req.query.search) {
        const searchTerm = req.query.search.toLowerCase();
        const filteredCampaigns = campaigns.filter(c => 
            c.title.toLowerCase().includes(searchTerm) || 
            c.shortDescription.toLowerCase().includes(searchTerm)
        );
        
        return res.json({ success: true, campaigns: filteredCampaigns });
    }
    
    res.json({ success: true, campaigns });
});

// User registration routes would be here in a real application
app.get('/sign-up', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'sign_up.html'));
});

app.get('/sign-in', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'sign_in.html'));
});

// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
