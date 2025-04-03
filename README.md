# MediAssist - Healthcare Platform

MediAssist is a comprehensive healthcare platform that combines modern technology with medical services to provide accessible healthcare solutions. The platform offers various features including doctor appointments, telehealth services, emergency assistance, and an AI-powered medical chatbot.

## Features

### 1. User Authentication
- Secure user registration and login system
- Session management
- Password hashing for security

### 2. Doctor Appointment System
- Doctor directory with detailed profiles
- Real-time availability checking
- Appointment scheduling
- Multi-language support for doctors
- Specialization-based doctor search

### 3. Telehealth Services
- Online consultation requests
- Insurance verification
- Virtual appointment scheduling
- Emergency SOS alerts
- Location-based service matching

### 4. Emergency Services
- Quick emergency assistance
- Location tracking
- Estimated response time calculation
- Nearby medical facility mapping
- Mobile clinic requests

### 5. AI-Powered Medical Chatbot
- General health information
- Symptom guidance
- Related medical video recommendations
- Location-aware responses
- Emergency situation handling

### 6. Healthcare Records Management
- Patient records
- Health history
- Prescriptions
- Lab reports
- Treatment plans

## Technical Stack

- **Backend**: Node.js with Express.js
- **Database**: SQLite3
- **Authentication**: bcrypt, express-session
- **AI Integration**: Google Gemini AI
- **External APIs**: 
  - Google Maps API
  - YouTube API
  - Gemini AI API

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- SQLite3
- API keys for:
  - Google Maps
  - YouTube
  - Gemini AI

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mediconnect-healthcare-app.git
cd mediconnect-healthcare-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
PORT=3000
YOUTUBE_API_KEY=your_youtube_api_key
MAPS_API_KEY=your_maps_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
GEMINI_API_KEY=your_gemini_api_key
```

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/signup` - User registration
- `POST /api/signin` - User login
- `GET /logout` - User logout

### Doctor Appointments
- `GET /api/doctors` - Get list of doctors
- `POST /api/appointments` - Schedule appointment
- `GET /api/appointments` - Get appointments

### Telehealth
- `POST /api/telehealth/consultation` - Request consultation
- `POST /api/telehealth/insurance` - Verify insurance
- `POST /api/telehealth/appointment` - Schedule telehealth appointment
- `POST /api/telehealth/sos` - Emergency SOS alert

### Chatbot
- `POST /api/chat` - Chat with medical AI
- `GET /api/maps-key` - Get maps API key
- `POST /emergency` - Emergency assistance

## Database Structure

The application uses multiple SQLite databases:
- `new_users.db` - User authentication
- `appointment_system.db` - Doctor appointments
- `telehealth.db` - Telehealth services
- `healthcare.db` - Healthcare records
- `mediassist.db` - Staff recruitment

## Security Features

- Password hashing with bcrypt
- Session-based authentication
- Secure file upload handling
- API key protection
- Input validation
- CORS configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support, please contact the development team or open an issue in the repository.

## Acknowledgments

- Google Maps API for location services
- YouTube API for medical video recommendations
- Gemini AI for chatbot functionality
- All contributors and maintainers 