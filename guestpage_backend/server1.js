// server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'guestpage_backend')));

// Mock database for demo purposes
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

// Helper function to calculate distance (simplified for demo)
function calculateDistance(lat1, lng1, lat2, lng2) {
  // Very simple distance calculation for demonstration
  // In a real app, you'd use the Haversine formula or a mapping API
  const latDiff = Math.abs(lat1 - lat2);
  const lngDiff = Math.abs(lng1 - lng2);
  return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111; // Rough km conversion
}

// Helper function to geocode an address (mock version)
function geocodeAddress(address) {
  // In a real app, you'd use a geocoding service like Google Maps API
  // For demo, we'll return a random location near New York City
  const baseLat = 40.7128;
  const baseLng = -74.0060;
  const randomOffset = () => (Math.random() - 0.5) * 0.02;
  
  return {
    lat: baseLat + randomOffset(),
    lng: baseLng + randomOffset(),
    formattedAddress: address
  };
}

// API Routes

// Get mobile clinic schedule
app.post('/api/request-mobile-clinic', (req, res) => {
  try {
    const { location, serviceType, date } = req.body;
    
    if (!location || !serviceType || !date) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    
    // Create a tracking ID
    const trackingId = 'MCLC-' + Math.floor(Math.random() * 10000);
    
    // Generate a random arrival date (1-3 days from requested date)
    const requestedDate = new Date(date);
    const daysToAdd = Math.floor(Math.random() * 3) + 1;
    const arrivalDate = new Date(requestedDate);
    arrivalDate.setDate(requestedDate.getDate() + daysToAdd);
    
    // Format the arrival date
    const estimatedArrival = arrivalDate.toISOString().split('T')[0];
    
    // Save to mock database
    const mobileClinicRequest = {
      id: uuidv4(),
      location,
      serviceType,
      requestedDate: date,
      estimatedArrival,
      trackingId,
      status: 'scheduled'
    };
    
    mockDB.mobileClinics.push(mobileClinicRequest);
    
    res.json({
      success: true,
      trackingId,
      estimatedArrival,
      message: 'Mobile clinic request processed successfully'
    });
  } catch (error) {
    console.error('Error processing mobile clinic request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Connect to nearest emergency service
app.post('/api/emergency-connect', (req, res) => {
  try {
    const { location } = req.body;
    
    if (!location) {
      return res.status(400).json({ success: false, message: 'Location is required' });
    }
    
    // Generate a realistic emergency ID
    const emergencyId = 'EM-' + Math.floor(Math.random() * 10000);
    
    // Find a random emergency facility
    const emergencyFacilities = mockDB.facilities.filter(f => f.emergency);
    const randomIndex = Math.floor(Math.random() * emergencyFacilities.length);
    const nearestService = emergencyFacilities[randomIndex].name;
    
    // Generate a random ETA (5-20 minutes)
    const estimatedResponse = `${Math.floor(Math.random() * 16) + 5} minutes`;
    
    // Save the emergency request
    const emergencyRequest = {
      id: uuidv4(),
      location,
      timestamp: new Date(),
      emergencyId,
      facilityAssigned: nearestService,
      estimatedResponse,
      status: 'dispatched'
    };
    
    mockDB.emergencyRequests.push(emergencyRequest);
    
    res.json({
      success: true,
      emergencyId,
      nearestService,
      estimatedResponse,
      message: 'Emergency services dispatched'
    });
  } catch (error) {
    console.error('Error connecting to emergency services:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get nearby facilities
app.get('/api/nearby-facilities', (req, res) => {
  try {
    const { location, type, radius } = req.query;
    const searchRadius = parseFloat(radius) || 5; // Default 5km radius
    
    if (!location) {
      return res.status(400).json({ success: false, message: 'Location is required' });
    }
    
    // Get geocoded location (in real app, this would call a geocoding API)
    const userLocation = geocodeAddress(location);
    
    // Filter facilities by type and distance
    let filteredFacilities = mockDB.facilities;
    if (type && type !== 'all') {
      filteredFacilities = filteredFacilities.filter(f => f.type === type);
    }
    
    // Calculate distance for each facility and filter by radius
    const facilitiesWithDistance = filteredFacilities.map(facility => {
      const distance = calculateDistance(
        userLocation.lat, 
        userLocation.lng,
        facility.location.lat,
        facility.location.lng
      );
      
      return {
        ...facility,
        distance: `${distance.toFixed(1)} km`
      };
    }).filter(f => parseFloat(f.distance) <= searchRadius);
    
    // Sort by distance
    facilitiesWithDistance.sort((a, b) => 
      parseFloat(a.distance) - parseFloat(b.distance)
    );
    
    res.json({
      success: true,
      location: userLocation.formattedAddress,
      radius: searchRadius,
      facilities: facilitiesWithDistance,
      count: facilitiesWithDistance.length
    });
  } catch (error) {
    console.error('Error finding nearby facilities:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Handle contact form
app.post('/api/contact', (req, res) => {
  try {
    const { name, email, phone, message } = req.body;
    
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, message: 'Name, email, and message are required' });
    }
    
    // Reference number for the contact
    const referenceId = 'CNT-' + Math.floor(Math.random() * 10000);
    
    // Save contact information
    const contactEntry = {
      id: uuidv4(),
      name,
      email,
      phone,
      message,
      referenceId,
      timestamp: new Date(),
      status: 'unread'
    };
    
    mockDB.contacts.push(contactEntry);
    
    // In a real application, you might send an email notification here
    
    res.json({
      success: true,
      referenceId,
      message: `Thank you for contacting us, ${name}! Your message has been received and we will get back to you soon. Your reference ID is ${referenceId}.`
    });
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get active health campaigns
app.get('/api/campaigns', (req, res) => {
  try {
    // Get current campaigns
    const currentDate = new Date();
    const activeCampaigns = mockDB.campaigns.filter(campaign => {
      const startDate = new Date(campaign.startDate);
      const endDate = new Date(campaign.endDate);
      return startDate <= currentDate && endDate >= currentDate;
    });
    
    res.json({
      success: true,
      campaigns: activeCampaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Join a health campaign
app.post('/api/join-campaign', (req, res) => {
  try {
    const { campaignId, name, email, phone } = req.body;
    
    if (!campaignId || !name || !email) {
      return res.status(400).json({ success: false, message: 'Campaign ID, name, and email are required' });
    }
    
    // Check if campaign exists
    const campaign = mockDB.campaigns.find(c => c.id === campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    // Generate membership ID
    const membershipId = 'MEM-' + Math.floor(Math.random() * 10000);
    
    // In a real app, you would save this to a database
    // and possibly send a confirmation email
    
    res.json({
      success: true,
      membershipId,
      campaignName: campaign.name,
      message: `Thank you for joining the ${campaign.name} campaign! Your membership ID is ${membershipId}.`
    });
  } catch (error) {
    console.error('Error joining campaign:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get upcoming mobile clinic schedule
app.get('/api/mobile-clinic-schedule', (req, res) => {
  try {
    const { location } = req.query;
    
    // In a real app, you would filter based on proximity to the location
    // For this demo, we'll just return all scheduled clinics
    const upcomingClinics = mockDB.mobileClinics.filter(clinic => 
      clinic.status === 'scheduled'
    );
    
    res.json({
      success: true,
      location: location || 'All locations',
      schedule: upcomingClinics
    });
  } catch (error) {
    console.error('Error fetching mobile clinic schedule:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Track mobile clinic request
app.get('/api/track-request/:trackingId', (req, res) => {
  try {
    const { trackingId } = req.params;
    
    // Find the request with the given tracking ID
    const request = mockDB.mobileClinics.find(clinic => clinic.trackingId === trackingId);
    
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }
    
    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error('Error tracking request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Register for a service
app.post('/api/register-service', (req, res) => {
  try {
    const { name, email, phone, service, preferredDate } = req.body;
    
    if (!name || !email || !service) {
      return res.status(400).json({ success: false, message: 'Name, email, and service are required' });
    }
    
    // Generate a registration ID
    const registrationId = 'REG-' + Math.floor(Math.random() * 10000);
    
    // In a real app, you would save this to a database
    
    res.json({
      success: true,
      registrationId,
      service,
      message: `Thank you for registering for ${service}! Your registration ID is ${registrationId}.`
    });
  } catch (error) {
    console.error('Error registering for service:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Get health resources
app.get('/api/resources', (req, res) => {
  try {
    // In a real app, you would fetch these from a database
    const resources = [
      {
        id: 'r001',
        title: 'Nutrition & Healthy Eating',
        type: 'video',
        url: 'https://www.youtube.com/embed/Gmituf01aJ4',
        description: 'Learn about balanced diets and healthy eating habits for the whole family.'
      },
      {
        id: 'r002',
        title: 'Exercise & Physical Activity',
        type: 'video',
        url: 'https://www.youtube.com/embed/wWGulLAa0O0',
        description: 'Simple exercises and physical activities for people of all ages and abilities.'
      },
      {
        id: 'r003',
        title: 'Emergency First Aid',
        type: 'video',
        url: 'https://www.youtube.com/embed/WqhZf9jhrhY',
        description: 'Essential first aid techniques everyone should know.'
      },
      {
        id: 'r004',
        title: 'Diabetes Prevention Guide',
        type: 'pdf',
        url: '/resources/diabetes-prevention.pdf',
        description: 'Comprehensive guide to preventing and managing diabetes.'
      }
    ];
    
    res.json({
      success: true,
      resources
    });
  } catch (error) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// User registration
app.post('/api/register', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }
    
    // Check if email already exists
    const existingUser = mockDB.users.find(user => user.email === email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    
    // Create new user
    const newUser = {
      id: uuidv4(),
      name,
      email,
      phone: phone || '',
      // In a real app, you would hash the password
      passwordHash: password,
      createdAt: new Date()
    };
    
    mockDB.users.push(newUser);
    
    res.json({
      success: true,
      userId: newUser.id,
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// User login
app.post('/api/login', (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    
    // Find user by email
    const user = mockDB.users.find(user => user.email === email);
    
    if (!user || user.passwordHash !== password) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    
    // In a real app, you would generate a JWT token here
    const token = `mockToken-${user.id}-${Date.now()}`;
    
    res.json({
      success: true,
      token,
      userId: user.id,
      name: user.name,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Language translations API
app.get('/api/translations/:lang', (req, res) => {
  try {
    const { lang } = req.params;
    
    const translations = {
      en: {
        'nav-home': 'Home',
        'nav-services': 'Services',
        'nav-doctors': 'Doctors',
        'nav-about': 'About Us',
        'nav-contact': 'Contact',
        'nav-emergency': 'Emergency Service',
        'hero-title': 'Your Health, Our Priority',
        'hero-text': 'We provide top-quality healthcare services with a patient-centered approach. Our team of expert medical professionals is dedicated to improving your well-being through personalized care and innovative treatments.',
        'book-appointment': 'Book an Appointment',
        'our-services': 'Our Services',
        'services-subtitle': 'We offer a comprehensive range of medical services to meet all your healthcare needs',
        'ai-chatbot': 'AI Chatbot Assistant',
        'ai-chatbot-desc': 'Get instant health information and guidance from our intelligent AI chatbot, available 24/7 to answer your questions.',
        'modern-facilities': 'Modern Facilities',
        'modern-facilities-desc': 'State-of-the-art medical equipment and comfortable facilities to ensure the best care possible.',
        'telehealth': 'Telehealth Services',
        'telehealth-desc': 'Connect with our doctors from the comfort of your home through our secure telehealth platform.',
        'hiring': "We're Hiring!",
        'join-team': 'Join Our Healthcare Team',
        'join-team-desc': "We're looking for passionate healthcare professionals to join our growing team. Explore exciting career opportunities with competitive benefits and a supportive work environment.",
        'view-positions': 'View Open Positions',
        'testimonials': 'What Our Patients Say',
        'testimonials-subtitle': 'Hear from people whose lives have been transformed by our care'
      },
      hi: {
        'nav-home': 'होम',
        'nav-services': 'सेवाएं',
        'nav-doctors': 'डॉक्टर',
        'nav-about': 'हमारे बारे में',
        'nav-contact': 'संपर्क',
        'nav-emergency': 'आपातकालीन सेवा',
        'hero-title': 'आपका स्वास्थ्य, आमादें प्राधान्यता',
        'hero-text': 'हम रोगी-केंद्रित दृष्टिकोनासह उच्च-गुणवत्तेची आरोग्यसेवा देतो. आमादें तज्ज्ञ वैद्यकीय व्यावसायिकांची टीम वैयक्तिकृत काळजी आणि नवीन उपचारांद्वारे तुमच्या कल्याणात सुधारणा करण्यासाठी समर्पित आहे.',
        'book-appointment': 'अपॉइंटमेंट बुक करा',
        'our-services': 'आमादें सेवा',
        'services-subtitle': 'तुमच्या सर्व आरोग्यसेवा गरजा पूर्ण करण्यासाठी व्यापक वैद्यकीय सेवा देतो',
        'ai-chatbot': 'एआय चॅटबॉट सहाय्यक',
        'ai-chatbot-desc': 'आमादें बुद्धिमान एआय चॅटबॉट थेव्हून तात्काळ आरोग्य माहिती आणि मार्गदर्शन मिळवा, तुमच्या प्रश्नांची उत्तरे देण्यासाठी 24/7 उपलब्ध.',
        'modern-facilities': 'आधुनिक सुबिधा',
        'modern-facilities-desc': 'सर्वोत्तम संभाव्य काळजी सुनिश्चित करण्यासाठी आधुनिक वैद्यकीय उपकरणे आणि आरामदायक सुबिधा.',
        'telehealth': 'टेलिहेल्थ सेवा',
        'telehealth-desc': 'आमादें सुरक्षित टेलिहेल्थ प्लॅटफॉर्मद्वारे तुमच्या घराच्या आरामातून आमादें डॉक्टरांशी जोडा.',
        'hiring': 'आमादें भरती करत आहोत!',
        'join-team': 'आमादें आरोग्य टीममध्ये सामील व्हा',
        'join-team-desc': 'आमादें आमादें वाढत्या टीममध्ये सामील होण्यासाठी उत्साही आरोग्य व्यावसायिक शोधत आहोत. स्पर्धात्मक लाभ आणि सहाय्यक कार्य वातावरणासह रोमांचक कारकीर्दीच्या संधी एक्सप्लोर करा.',
        'view-positions': 'रिक्त पदे पहा',
        'testimonials': 'आमादें रुग्ण काय म्हणतात',
        'testimonials-subtitle': 'या जीवनात आमादें आरोग्यने बदलले आहे त्यांच्याकडून ऐका'
      },
      ta: {
        'nav-home': 'முகப்பு',
        'nav-services': 'சேவைகள்',
        'nav-doctors': 'மருத்துவர்கள்',
        'nav-about': 'எங்களை பற்றி',
        'nav-contact': 'தொடர்பு',
        'nav-emergency': 'அவசர சேவை',
        'hero-title': 'உங்கள் ஆரோக்கியம், எங்கள் முன்னுரிமை',
        'hero-text': 'நாங்கள் நோயாளி-மைய அணுகுமுறையுடன் உயர்தர சுகாதார சேவைகளை வழங்குகிறோம். எங்கள் நிபுணர் மருத்துவ நிபுணர்கள் குழு தனிப்பயனாக்கப்பட்ட பராமரிப்பு மற்றும் புதுமையான சிகிச்சைகள் மூலம் உங்கள் நல்வாழ்வை மேம்படுத்துவதில் அர்ப்பணிக்கப்பட்டுள்ளது.',
        'book-appointment': 'நேரம் பதிவு செய்ய',
        'our-services': 'எங்கள் சேவைகள்',
        'services-subtitle': 'உங்கள் அனைத்து சுகாதார தேவைகளையும் பூர்த்தி செய்ய விரிவான மருத்துவ சேவைகளை வழங்குகிறோம்',
        'ai-chatbot': 'எந்திர அறிவு உரையாடல் உதவியாளர்',
        'ai-chatbot-desc': 'எங்கள் புத்திசாலி எந்திர அறிவு உரையாடலிலிருந்து உடனடி சுகாதார தகவல்கள் மற்றும் வழிகாட்டுதலை பெறுங்கள், உங்கள் கேள்விகளுக்கு பதிலளிக்க 24/7 உபலவுடைய.',
        'modern-facilities': 'நவீன வசதிகள்',
        'modern-facilities-desc': 'சிறந்த சாத்தியமான பராமரிப்பை உறுதி செய்ய நவீன மருத்துவ உபகரணங்கள் மற்றும் வசதியான வசதிகள்.',
        'telehealth': 'தொலை சுகாதார சேவைகள்',
        'telehealth-desc': 'எங்கள் பாதுகாப்பான தொலை சுகாதார தளத்தின் மூலம் உங்கள் வீட்டின் வசதியிலிருந்து எங்கள் மருத்துவர்களுடன் இணைக்கவும்.',
        'hiring': 'நாங்கள் வேலைக்கு அமர்த்துகிறோம்!',
        'join-team': 'எங்கள் சுகாதார குழுவில் சேரவும்',
        'join-team-desc': 'நாங்கள் எங்கள் வளர்ந்து வரும் குழுவில் சேர துடிப்பான சுகாதார நிபுணர்களை தேடுகிறோம். போட்டி நன்மைகள் மற்றும் ஸஹாயகமைந்த பணி சூழலுடன் உத்தேஜகரமைந்த கெரியர் அவகாஶங்களை அந்வேஷிக்கவும்.',
        'view-positions': 'காலியான பதவிகளைக் காண்க',
        'testimonials': 'எங்கள் நோயாளிகள் என்ன சொல்கிறார்கள்',
        'testimonials-subtitle': 'எங்கள் பராமரிப்பால் வாழ்க்கை மாறியவர்களிடமிருந்து கேளுங்கள்'
      },
      te: {
        'nav-home': 'హోమ్',
        'nav-services': 'సేవలు',
        'nav-doctors': 'వైద్యులు',
        'nav-about': 'మా గురించి',
        'nav-contact': 'సంప్రదించండి',
        'nav-emergency': 'అత్యవసర సేవ',
        'hero-title': 'మీ ఆరోగ్యం, మా ప్రాధాన్యత',
        'hero-text': 'మేము రోగి-కేంద్రీకృత విధానంతో అధిక-నాణ్యత ఆరోగ్య సేవలను అందిస్తున్నాము. మా నిపుణ వైద్య నిపుణుల బృందం వ్యక్తిగత సంరక్షణ మరియు వినూత్న చికిత్సల ద్వారా మీ శ్రేయస్సును మెరుగుపరచడానికి అంకితం చేయబడింది.',
        'book-appointment': 'అపాయింట్మెంట్ బుక్ చేయండి',
        'our-services': 'మా సేవలు',
        'services-subtitle': 'మీ అన్ని ఆరోగ్య సంరక్షణ అవసరాలను తీర్చడానికి సమగ్ర వైద్య సేవలను అందిస్తున్నాము',
        'ai-chatbot': 'ఎయిచాట్‌బాట్ సహాయకుడు',
        'ai-chatbot-desc': 'మా తెలివైన ఎయిచాట్‌బాట్ నుండి తాత్కాలిక ఆరోగ్య సమాచారం మరియు మార్గదర్శకత్వాన్ని పొందండి, మీ ప్రశ్నలకు సమాధానం ఇవ్వడానికి 24/7 అందుబాటులో ఉంటుంది.',
        'modern-facilities': 'ఆధునిక సౌకర్యాలు',
        'modern-facilities-desc': 'ఉత్తమమైన సాధ్యమైన సంరక్షణను నిర్ధారించడానికి ఆధునిక వైద్య పరికరాలు మరియు సౌకర్యవంతమైన సౌకర్యాలు.',
        'telehealth': 'టెలిహెల్త్ సేవలు',
        'telehealth-desc': 'మా సురక్షితమైన టెలిహెల్త్ ప్లాట్‌ఫారమ్ ద్వారా మీ ఇంటి సౌకర్యం నుండి మా వైద్యులతో కనెక్ట్ అవ్వండి.',
        'hiring': 'మేము నియమించుకుంటున్నాము!',
        'join-team': 'మా ఆరోగ్య టీమ్‌లో చేరండి',
        'join-team-desc': 'మేము మా వాఢతయా టీమ్‌లో చేరడానికి ఉత్సాహభరితమైన ఆరోగ్య వైద్యులను వెతుకుతున్నాము. పోటీ ప్రయోజనాలు మరియు సహాయకమైన పని వాతావరణంతో ఉత్తేజకరమైన కెరియర్ అవకాశాలను అన్వేషించండి.',
        'view-positions': 'ఖాళీ పదాలను చూడండి',
        'testimonials': 'మా రోగులు ఏమి చెబుతున్నారు',
        'testimonials-subtitle': 'మా సంరక్షణతో జీవితాలు మారిన వారి నుండి వినండి'
      },
      bn: {
        'nav-home': 'হোম',
        'nav-services': 'সেবা',
        'nav-doctors': 'ডাক্তার',
        'nav-about': 'আমাদের সম্পর্কে',
        'nav-contact': 'যোগাযোগ',
        'nav-emergency': 'জরুরি সেবা',
        'hero-title': 'আপনার স্বাস্থ্য, আমাদের অগ্রাধিকার',
        'hero-text': 'আমরা রোগী-কেন্দ্রিক দৃষ্টিভঙ্গি সহ উচ্চ-মানের স্বাস্থ্যসেবা প্রদান করি। আমাদের বিশেষজ্ঞ চিকিত্সা পেশাদারদের দল ব্যক্তিগত সেবা এবং উদ্ভাবনী চিকিত্সার মাধ্যমে আপনার সুস্থতার উন্নতির জন্য নিবেদিত।',
        'book-appointment': 'অ্যাপয়েন্টমেন্ট বুক করুন',
        'our-services': 'আমাদের সেবা',
        'services-subtitle': 'আপনার সমস্ত স্বাস্থ্যসেবা চাহিদা পূরণের জন্য বিস্তৃত চিকিত্সা সেবা প্রদান করি',
        'ai-chatbot': 'এআই চ্যাটবট সহকারী',
        'ai-chatbot-desc': 'আমাদের বুদ্ধিমান এআই চ্যাটবট থেকে তাৎক্ষণিক স্বাস্থ্য তথ্য এবং নির্দেশনা পান, আপনার প্রশ্নের উত্তর দিতে 24/7 উপলব্ধ।',
        'modern-facilities': 'আধুনিক সুবিধা',
        'modern-facilities-desc': 'সর্বোত্তম সম্ভাব্য সেবা নিশ্চিত করতে আধুনিক চিকিত্সা সরঞ্জাম এবং আরামদায়ক সুবিধা।',
        'telehealth': 'টেলিহেলথ সেবা',
        'telehealth-desc': 'আমাদের নিরাপদ টেলিহেলথ প্ল্যাটফর্মের মাধ্যমে আপনার বাড়ির আরাম থেকে আমাদের ডাক্তারদের সাথে যোগাযোগ করুন।',
        'hiring': 'আমরা নিয়োগ করছি!',
        'join-team': 'আমাদের স্বাস্থ্য দলে যোগ দিন',
        'join-team-desc': 'আমরা আমাদের বর্ধমান দলে যোগ দিতে উত্সাহী স্বাস্থ্য পেশাদারদের খুঁজছি। প্রতিযোগিতামূলক সুবিধা এবং সহায়ক কর্মক্ষেত্র সহ উত্তেজনাপূর্ণ ক্যারিয়ারের সুযোগ অন্বেষণ করুন।',
        'view-positions': 'খালি পদগুলি দেখুন',
        'testimonials': 'আমাদের রোগীরা কি বলেন',
        'testimonials-subtitle': 'যাদের জীবন আমাদের সেবার মাধ্যমে পরিবর্তিত হয়েছে তাদের কাছ থেকে শুনুন'
      },
      mr: {
        'nav-home': 'होम',
        'nav-services': 'सेवा',
        'nav-doctors': 'डॉक्टर',
        'nav-about': 'आमच्याबद्दल',
        'nav-contact': 'संपर्क',
        'nav-emergency': 'आपत्कालीन सेवा',
        'hero-title': 'तुमचे आरोग्य, आमची प्राधान्यता',
        'hero-text': 'आम्ही रुग्ण-केंद्रित दृष्टिकोनासह उच्च-गुणवत्तेची आरोग्यसेवा देतो. आमची तज्ज्ञ वैद्यकीय व्यावसायिकांची टीम वैयक्तिकृत काळजी आणि नवीन उपचारांद्वारे तुमच्या कल्याणात सुधारणा करण्यासाठी समर्पित आहे.',
        'book-appointment': 'अपॉइंटमेंट बुक करा',
        'our-services': 'आमच्या सेवा',
        'services-subtitle': 'तुमच्या सर्व आरोग्यसेवा गरजा पूर्ण करण्यासाठी व्यापक वैद्यकीय सेवा देतो',
        'ai-chatbot': 'एआय चॅटबॉट सहाय्यक',
        'ai-chatbot-desc': 'आमच्या बुद्धिमान एआय चॅटबॉटमधून तात्काळ आरोग्य माहिती आणि मार्गदर्शन मिळवा, तुमच्या प्रश्नांची उत्तरे देण्यासाठी 24/7 उपलब्ध.',
        'modern-facilities': 'आधुनिक सुविधा',
        'modern-facilities-desc': 'सर्वोत्तम संभाव्य काळजी सुनिश्चित करण्यासाठी आधुनिक वैद्यकीय उपकरणे आणि आरामदायक सुविधा.',
        'telehealth': 'टेलिहेल्थ सेवा',
        'telehealth-desc': 'आमच्या सुरक्षित टेलिहेल्थ प्लॅटफॉर्मद्वारे तुमच्या घराच्या आरामातून आमच्या डॉक्टरांशी जोडा.',
        'hiring': 'आम्ही भरती करत आहोत!',
        'join-team': 'आमच्या आरोग्य टीममध्ये सामील व्हा',
        'join-team-desc': 'आम्ही आमच्या वाढत्या टीममध्ये सामील होण्यासाठी उत्साही आरोग्य व्यावसायिक शोधत आहोत. स्पर्धात्मक लाभ आणि सहाय्यक कार्य वातावरणासह रोमांचक कारकीर्दीच्या संधी एक्सप्लोर करा.',
        'view-positions': 'रिक्त पदे पहा',
        'testimonials': 'आमचे रुग्ण काय म्हणतात',
        'testimonials-subtitle': 'ज्यांचे जीवन आमच्या आरोग्यने बदलले आहे त्यांच्याकडून ऐका'
      }
    };
    
    if (!translations[lang]) {
      return res.status(404).json({ success: false, message: 'Language not found' });
    }
    
    res.json({
      success: true,
      language: lang,
      translations: translations[lang]
    });
  } catch (error) {
    console.error('Error fetching translations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Catch-all route for the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'final_guestpage.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // For testing purposes