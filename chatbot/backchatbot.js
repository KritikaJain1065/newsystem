require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const bodyParser = require('body-parser');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// API Keys from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const MAPS_API_KEY = process.env.MAPS_API_KEY;

// Disease database for fallback responses when Gemini API is not working
const diseaseDatabase = {
    "headache": {
        "description": "Pain in any region of the head.",
        "causes": "Stress, dehydration, lack of sleep, eye strain, sinusitis, or migraine.",
        "treatment": "Rest, hydration, over-the-counter pain relievers like acetaminophen or ibuprofen, and reducing screen time.",
        "when_to_see_doctor": "If headaches are severe, persistent, or accompanied by fever, confusion, stiff neck, or vision changes."
    },
    "migraine": {
        "description": "A neurological condition characterized by intense, debilitating headaches often accompanied by nausea and sensitivity to light and sound.",
        "causes": "Genetic factors, hormonal changes, certain foods, stress, environmental factors like bright lights or strong smells.",
        "treatment": "Resting in a dark quiet room, prescription medications like triptans, preventive medications for frequent migraines.",
        "when_to_see_doctor": "If you experience new or unusual headache patterns, or if migraines significantly impact your quality of life."
    },
    "fever": {
        "description": "An elevated body temperature, typically above 100.4°F (38°C).",
        "causes": "Infections (viral, bacterial, parasitic), inflammation, certain medications, vaccines, and some medical conditions.",
        "treatment": "Rest, hydration, over-the-counter fever reducers like acetaminophen or ibuprofen, and lightweight clothing.",
        "when_to_see_doctor": "If fever is above 103°F (39.4°C), lasts more than three days, or is accompanied by severe symptoms."
    },
    "cough": {
        "description": "A sudden expulsion of air from the lungs to clear the air passages.",
        "causes": "Viral infections, allergies, asthma, GERD, smoking, or environmental irritants.",
        "treatment": "Hydration, honey (for those over 1 year old), cough drops, and over-the-counter cough suppressants.",
        "when_to_see_doctor": "If cough persists for more than three weeks, produces thick discolored mucus, or is accompanied by shortness of breath or chest pain."
    },
    "cold": {
        "description": "A common viral infection that affects the upper respiratory tract.",
        "causes": "Rhinoviruses and other viruses that spread through air droplets or contact with infected surfaces.",
        "treatment": "Rest, hydration, over-the-counter cold medications, and saline nasal sprays.",
        "when_to_see_doctor": "If symptoms worsen after 10 days, or if you experience high fever, severe sinus pain, or breathing difficulties."
    },
    "flu": {
        "description": "A contagious respiratory illness caused by influenza viruses.",
        "causes": "Influenza viruses that spread through air droplets when infected people cough, sneeze, or talk.",
        "treatment": "Rest, hydration, over-the-counter pain relievers, and antiviral medications if prescribed early.",
        "when_to_see_doctor": "If you have difficulty breathing, persistent chest pain, confusion, or severe or persistent vomiting."
    },
    "allergy": {
        "description": "An immune system response to substances that are typically harmless.",
        "causes": "Common allergens include pollen, dust mites, pet dander, certain foods, insect stings, and medications.",
        "treatment": "Avoiding allergens, over-the-counter antihistamines, nasal sprays, and, in severe cases, prescribed medications or immunotherapy.",
        "when_to_see_doctor": "If over-the-counter medications don't help or if you experience severe allergic reactions like difficulty breathing."
    },
    "pain": {
        "description": "An unpleasant sensory and emotional experience associated with actual or potential tissue damage.",
        "causes": "Injury, inflammation, disease, or nerve damage.",
        "treatment": "Rest, ice or heat application, over-the-counter pain relievers, physical therapy, or prescribed medications.",
        "when_to_see_doctor": "If pain is severe, doesn't improve with self-care, or limits daily activities."
    },
    "diabetes": {
        "description": "A chronic condition that affects how your body turns food into energy, characterized by high blood sugar levels.",
        "causes": "Type 1 is an autoimmune reaction, Type 2 is primarily due to insulin resistance, often related to lifestyle factors.",
        "treatment": "Diet management, regular exercise, blood sugar monitoring, and medications or insulin as prescribed.",
        "when_to_see_doctor": "If you experience symptoms like excessive thirst, frequent urination, unexplained weight loss, or fatigue."
    },
    "hypertension": {
        "description": "High blood pressure that can lead to serious health problems like heart disease and stroke.",
        "causes": "Age, family history, obesity, lack of physical activity, high sodium diet, stress, and certain medical conditions.",
        "treatment": "Lifestyle changes including healthy diet, regular exercise, limiting alcohol, and medications as prescribed.",
        "when_to_see_doctor": "If you have risk factors or symptoms like severe headaches, chest pain, difficulty breathing, or vision problems."
    },
    "anxiety": {
        "description": "A feeling of worry, nervousness, or unease about something with an uncertain outcome.",
        "causes": "Stress, trauma, personality factors, certain medical conditions, or substance use.",
        "treatment": "Psychotherapy, mindfulness techniques, stress management, physical activity, and sometimes medications.",
        "when_to_see_doctor": "If anxiety interferes with daily activities, relationships, or work performance."
    },
    "depression": {
        "description": "A mood disorder that causes a persistent feeling of sadness and loss of interest.",
        "causes": "Biological factors, brain chemistry, hormones, inherited traits, or difficult life events.",
        "treatment": "Psychotherapy, medications, lifestyle changes, and support groups.",
        "when_to_see_doctor": "If you have symptoms like persistent sadness, loss of interest, sleep changes, or thoughts of death or suicide."
    },
    "insomnia": {
        "description": "A sleep disorder characterized by difficulty falling asleep, staying asleep, or getting quality sleep.",
        "causes": "Stress, travel, work schedule, poor sleep habits, eating too much late in the evening, or mental health disorders.",
        "treatment": "Improving sleep habits, cognitive behavioral therapy for insomnia, relaxation techniques, and short-term use of sleep medications if prescribed.",
        "when_to_see_doctor": "If insomnia persists for more than a few weeks or significantly impacts daily functioning."
    },
    "arthritis": {
        "description": "Inflammation of one or more joints, causing pain and stiffness that can worsen with age.",
        "causes": "Cartilage breakdown, normal wear and tear, infections, or autoimmune disorders depending on the type of arthritis.",
        "treatment": "Physical therapy, medications for pain and inflammation, and in severe cases, surgery.",
        "when_to_see_doctor": "If you experience joint pain, stiffness, or swelling that doesn't improve with over-the-counter medications."
    },
    "asthma": {
        "description": "A condition in which your airways narrow, swell, and may produce extra mucus, making breathing difficult.",
        "causes": "Genetic and environmental factors including allergens, respiratory infections, physical activity, cold air, or stress.",
        "treatment": "Quick-relief and long-term control medications, avoiding triggers, and monitoring breathing.",
        "when_to_see_doctor": "If you experience frequent asthma attacks, disturbed sleep, or limited daily activities due to breathing problems."
    },
    "obesity": {
        "description": "A complex disease involving an excessive amount of body fat, typically defined as a BMI of 30 or higher.",
        "causes": "Genetic factors, overeating, consuming high-calorie foods, physical inactivity, and certain medications or medical conditions.",
        "treatment": "Healthy diet, regular physical activity, behavior changes, and in some cases, prescription medications or weight-loss surgery.",
        "when_to_see_doctor": "If you're concerned about your weight or weight-related health problems."
    },
    "heart disease": {
        "description": "A range of conditions that affect your heart, including coronary artery disease, heart rhythm problems, and heart defects.",
        "causes": "High blood pressure, high cholesterol, smoking, diabetes, family history, poor diet, physical inactivity, and stress.",
        "treatment": "Lifestyle changes, medications, and medical procedures or surgery as needed.",
        "when_to_see_doctor": "If you experience chest pain, shortness of breath, fainting, or irregular heartbeats."
    },
    "cancer": {
        "description": "A disease in which abnormal cells divide uncontrollably and can invade nearby tissues.",
        "causes": "Genetic factors, exposure to carcinogens like tobacco smoke, radiation, certain viruses, and lifestyle factors.",
        "treatment": "Surgery, chemotherapy, radiation therapy, immunotherapy, or targeted therapy, depending on the type and stage.",
        "when_to_see_doctor": "If you notice unexplained weight loss, persistent fatigue, pain, skin changes, or unusual bleeding."
    },
    "stroke": {
        "description": "A medical emergency where blood supply to part of the brain is interrupted or reduced, depriving brain tissue of oxygen and nutrients.",
        "causes": "Blocked or burst blood vessels in the brain, often due to high blood pressure, smoking, diabetes, or high cholesterol.",
        "treatment": "Immediate emergency treatment to restore blood flow or stop bleeding, followed by rehabilitation.",
        "when_to_see_doctor": "EMERGENCY: If you notice face drooping, arm weakness, speech difficulty, or sudden confusion, call emergency services immediately."
    },
    "alzheimer": {
        "description": "A progressive neurological disorder that causes brain cells to degenerate and die, leading to memory loss and cognitive decline.",
        "causes": "Combination of genetic, lifestyle, and environmental factors that affect the brain over time.",
        "treatment": "Medications to temporarily improve symptoms, and supportive care.",
        "when_to_see_doctor": "If you or a loved one experiences persistent memory problems, confusion, or changes in thinking skills."
    },
    "covid": {
        "description": "An infectious disease caused by the SARS-CoV-2 virus, primarily affecting the respiratory system.",
        "causes": "Infection with the SARS-CoV-2 virus, which spreads through respiratory droplets.",
        "treatment": "Rest, hydration, over-the-counter fever reducers, and in severe cases, prescribed antiviral medications or hospitalization.",
        "when_to_see_doctor": "If you experience difficulty breathing, persistent chest pain, confusion, or bluish lips or face."
    },
    "pneumonia": {
        "description": "An infection that inflames the air sacs in one or both lungs, which may fill with fluid.",
        "causes": "Bacteria, viruses, or fungi that enter the lungs.",
        "treatment": "Antibiotics for bacterial pneumonia, antiviral medications for viral pneumonia, and supportive care including rest and hydration.",
        "when_to_see_doctor": "If you have a high fever, severe cough with phlegm, difficulty breathing, or chest pain."
    },
    "bronchitis": {
        "description": "Inflammation of the lining of the bronchial tubes, which carry air to and from the lungs.",
        "causes": "Viral infections, bacterial infections, or irritants like smoke or air pollution.",
        "treatment": "Rest, hydration, over-the-counter pain relievers, and in some cases, antibiotics or inhalers.",
        "when_to_see_doctor": "If symptoms last more than three weeks, you have repeated episodes, or you have difficulty breathing."
    },
    "sinusitis": {
        "description": "Inflammation or swelling of the tissue lining the sinuses, often resulting in blocked sinuses filled with fluid.",
        "causes": "Viral infections, bacterial infections, nasal polyps, or allergies.",
        "treatment": "Nasal corticosteroids, saline nasal irrigation, over-the-counter pain relievers, and in some cases, antibiotics.",
        "when_to_see_doctor": "If symptoms last more than 10 days, if the condition recurs frequently, or if over-the-counter medications don't help."
    },
    "ulcer": {
        "description": "A sore or hole in the lining of the stomach, duodenum, or esophagus.",
        "causes": "Helicobacter pylori bacteria, regular use of certain pain relievers, or excess stomach acid.",
        "treatment": "Antibiotics for H. pylori infections, medications to reduce stomach acid, and avoiding irritants like alcohol and spicy foods.",
        "when_to_see_doctor": "If you experience persistent stomach pain, black or bloody stools, or vomit that looks like coffee grounds."
    },
    "gerd": {
        "description": "A chronic digestive disease that occurs when stomach acid or bile flows back into the food pipe (esophagus).",
        "causes": "Frequent acid reflux, often due to a relaxed lower esophageal sphincter.",
        "treatment": "Lifestyle changes such as weight loss and avoiding trigger foods, over-the-counter antacids, or prescription medications.",
        "when_to_see_doctor": "If you have frequent or severe heartburn, difficulty swallowing, or persistent nausea or vomiting."
    },
    "ibs": {
        "description": "Irritable Bowel Syndrome is a common disorder that affects the large intestine, causing cramping, abdominal pain, bloating, gas, diarrhea, and constipation.",
        "causes": "Muscle contractions in the intestine, nervous system abnormalities, inflammation, severe infection, or changes in gut bacteria.",
        "treatment": "Dietary changes, stress management, probiotics, fiber supplements, and medications to manage specific symptoms.",
        "when_to_see_doctor": "If you have persistent changes in bowel habits, severe pain, weight loss, rectal bleeding, or nighttime symptoms."
    },
    "uti": {
        "description": "Urinary Tract Infection is an infection in any part of the urinary system, including kidneys, bladder, ureters, and urethra.",
        "causes": "Bacteria entering the urinary tract through the urethra and multiplying in the bladder.",
        "treatment": "Antibiotics, pain relievers, and increased fluid intake.",
        "when_to_see_doctor": "If you experience pain or burning during urination, frequent urination, cloudy or strong-smelling urine, or pelvic pain."
    }
};

// Validate API keys
if (!GEMINI_API_KEY || !YOUTUBE_API_KEY || !MAPS_API_KEY) {
    console.error('One or more API keys are missing. Please configure them in environment variables.');
    process.exit(1);
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Helper function to list available models (for debugging)
async function listAvailableModels() {
    try {
        console.log("Initializing with model: gemini-1.5-flash");
        // Note: The GoogleGenerativeAI library might not support listing models
        // Commenting out the problematic line
        // const models = await genAI.listModels();
        // console.log("Available models:", models);
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

// Call this function during initialization to debug available models
listAvailableModels();

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

// Chat history to maintain context
const chatHistory = {};

// Define routes
// Home route to serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Chatbot route to serve the chatbot HTML file
app.get('/chatbot', (req, res) => {
    res.sendFile(path.join(__dirname, 'Chatbot_medic.html'));
});

// Maps API Key endpoint (for security)
app.get('/api/maps-key', (req, res) => {
    res.json({ key: MAPS_API_KEY });
});

// Chat API endpoint
app.post('/chat', async (req, res) => {
    try {
        // Validate the Gemini API key
        if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY") {
            console.error('Invalid Gemini API key. Please configure a valid key.');
            return res.status(500).json({ 
                text: "The AI service is not configured properly. Please contact support." 
            });
        }

        const userId = req.headers['user-id'] || 'default-user';
        const userMessage = req.body.message;
        
        if (!chatHistory[userId]) {
            chatHistory[userId] = [];
            console.log(`Initializing chat history for user: ${userId}`);
        }
        
        console.log(`Received message from user ${userId}: "${userMessage.substring(0, 50)}..."`);
        
        // Get AI response
        const aiResponse = await getAIResponse(userMessage, chatHistory[userId]);
        
        // Search for relevant YouTube videos
        const searchTerm = extractSearchTerms(userMessage, aiResponse.text);
        console.log(`Searching YouTube for: "${searchTerm}"`);
        const videos = await searchYouTubeVideos(searchTerm);
        
        // Update chat history
        chatHistory[userId].push({ role: 'user', parts: [{ text: userMessage }] });
        chatHistory[userId].push({ role: 'model', parts: [{ text: aiResponse.text }] });
        
        // Keep chat history at a reasonable size
        if (chatHistory[userId].length > 10) {
            chatHistory[userId] = chatHistory[userId].slice(-10);
        }
        
        console.log(`Chat history length for user ${userId}: ${chatHistory[userId].length}`);
        
        res.json({
            text: aiResponse.text,
            videos: videos // Frontend expects this structure
        });
    } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json({ text: 'Failed to process your request. Please try again later.' });
    }
});

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

// Helper function to get address from coordinates
async function getAddressFromCoordinates(lat, lng) {
    try {
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                latlng: `${lat},${lng}`,
                key: MAPS_API_KEY
            }
        });
        
        if (response.data.results && response.data.results.length > 0) {
            return response.data.results[0].formatted_address;
        } else {
            return "Unknown location";
        }
    } catch (error) {
        console.error('Error getting address from coordinates:', error);
        return "Unknown location";
    }
}

// Helper functions
async function getAIResponse(userMessage, history) {
    try {
        // Check if the user message contains known disease keywords first
        const diseaseResponse = getResponseFromDiseaseDatabase(userMessage);
        if (diseaseResponse) {
            console.log("Using disease database response");
            return { text: diseaseResponse };
        }
        
        // If no disease match, try using Gemini
        const chat = model.startChat({
            history: history,
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1000,
            },
        });

        const messageWithSystemPrompt = `${SYSTEM_PROMPT}\n\nUser query: ${userMessage}`;
        console.log("Sending message to Gemini with system prompt");

        const result = await chat.sendMessage(messageWithSystemPrompt);
        let responseText = "";

        // Fixed response handling
        if (result && result.response) {
            if (result.response.text) {
                responseText = result.response.text;
            } else if (result.response.candidates && 
                      result.response.candidates[0] && 
                      result.response.candidates[0].content && 
                      result.response.candidates[0].content.parts && 
                      result.response.candidates[0].content.parts[0]) {
                responseText = result.response.candidates[0].content.parts[0].text || "";
            }
        }

        // Ensure responseText is a string
        if (!responseText || typeof responseText !== "string") {
            responseText = "I'm having trouble processing your request right now. Please try again later.";
        }

        // Safely log a substring of the response
        console.log("Got response from Gemini:", responseText.substring(0, 50) + "...");
        return { text: responseText };
    } catch (error) {
        console.error("Error getting AI response:", error);
        
        // If Gemini fails, try using disease database as fallback
        const diseaseResponse = getResponseFromDiseaseDatabase(userMessage);
        if (diseaseResponse) {
            console.log("Using disease database as fallback");
            return { text: diseaseResponse };
        }
        
        if (error.message && error.message.includes("models/gemini-1.5-flash")) {
            return { text: "Error: The specified model is not available. Please contact support." };
        }
        return { text: "I'm having trouble processing your request right now. Please try again later." };
    }
}

// Function to get response from disease database
function getResponseFromDiseaseDatabase(userMessage) {
    const userMessageLower = userMessage.toLowerCase();
    
    // Check for exact matches in the database
    for (const [disease, info] of Object.entries(diseaseDatabase)) {
        if (userMessageLower.includes(disease)) {
            return formatDiseaseResponse(disease, info);
        }
    }
    
    // Check for symptom-based matches
    const symptomToDisease = {
        "chest pain": ["heart disease", "pneumonia"],
        "shortness of breath": ["asthma", "covid", "heart disease"],
        "runny nose": ["cold", "flu", "allergy"],
        "sore throat": ["cold", "flu", "strep throat"],
        "stomach ache": ["ulcer", "ibs", "gerd"],
        "stomach pain": ["ulcer", "ibs", "gerd"],
        "joint pain": ["arthritis"],
        "rash": ["allergy"],
        "itching": ["allergy"],
        "fatigue": ["depression", "anemia", "covid"],
        "tired": ["depression", "anemia", "insomnia"],
        "can't sleep": ["insomnia", "anxiety"],
        "trouble sleeping": ["insomnia", "anxiety"],
        "weight gain": ["obesity", "hypothyroidism"],
        "weight loss": ["diabetes", "hyperthyroidism"],
        "dizziness": ["hypertension", "anemia", "dehydration"],
        "nausea": ["flu", "food poisoning", "migraine"],
        "vomiting": ["flu", "food poisoning"],
        "diarrhea": ["food poisoning", "ibs", "infection"],
        "constipation": ["ibs", "dehydration"],
        "back pain": ["arthritis", "kidney stones", "muscle strain"],
        "memory loss": ["alzheimer", "dementia"],
        "forgetfulness": ["alzheimer", "dementia"],
        "frequent urination": ["diabetes", "uti", "prostate issues"],
        "vision problems": ["diabetes", "hypertension", "cataracts"],
        "high blood sugar": ["diabetes"],
        "high blood pressure": ["hypertension"],
        "sneezing": ["cold", "flu", "allergy"],
        "wheezing": ["asthma", "bronchitis"]
    };
    
    for (const [symptom, diseases] of Object.entries(symptomToDisease)) {
        if (userMessageLower.includes(symptom)) {
            // Take the first matched disease
            const disease = diseases[0];
            if (diseaseDatabase[disease]) {
                return formatDiseaseResponse(disease, diseaseDatabase[disease], 
                    `Based on your mention of ${symptom}, I'm providing information about ${disease}.`);
            }
        }
    }
    
    // No match found
    return null;
}  

// Function to format disease information into a user-friendly response
function formatDiseaseResponse(disease, info, prefix = "") {
    let response = prefix ? prefix + "\n\n" : "";
    response += `**${disease.charAt(0).toUpperCase() + disease.slice(1)}**\n\n`;
    response += `${info.description}\n\n`;
    response += `**Causes:**\n${info.causes}\n\n`;
    response += `**Treatment:**\n${info.treatment}\n\n`;
    response += `**When to see a doctor:**\n${info.when_to_see_doctor}\n\n`;
    response += "Remember: This information is for educational purposes only and does not replace professional medical advice. Please consult a healthcare provider for diagnosis and treatment.";
    
    return response;
}

// Extract search terms from user message and AI response
function extractSearchTerms(userMessage, aiResponse) {
    const userMessageLower = userMessage.toLowerCase();
    
    // Check if user query contains any disease from our database
    for (const disease of Object.keys(diseaseDatabase)) {
        if (userMessageLower.includes(disease)) {
            return `${disease} symptoms treatment medical information`;
        }
    }
    
    // Check for symptom matches
    const symptomToSearchTerm = {
        "chest pain": "chest pain cardiac or respiratory causes treatment",
        "shortness of breath": "dyspnea causes treatment breathing difficulty",
        "runny nose": "rhinitis treatment cold allergy",
        "sore throat": "pharyngitis treatment remedies",
        "stomach ache": "abdominal pain causes treatment",
        "stomach pain": "abdominal pain causes treatment",
        "joint pain": "arthralgia treatment pain management",
        "rash": "skin rash causes treatment dermatology",
        "itching": "pruritus causes treatment skin",
        "fatigue": "chronic fatigue causes treatment",
        "tired": "fatigue causes treatment energy",
        "can't sleep": "insomnia treatment sleep hygiene",
        "trouble sleeping": "insomnia treatment sleep hygiene",
        "weight gain": "weight gain causes management",
        "weight loss": "unexplained weight loss causes",
        "dizziness": "vertigo lightheadedness causes treatment",
        "nausea": "nausea causes treatment antiemetic",
        "vomiting": "vomiting treatment hydration",
        "diarrhea": "diarrhea treatment hydration diet",
        "constipation": "constipation relief treatment fiber",
        "back pain": "back pain treatment exercises physical therapy",
        "memory loss": "memory improvement cognitive decline treatment",
        "forgetfulness": "memory improvement cognitive exercises",
        "frequent urination": "polyuria causes treatment",
        "vision problems": "vision issues treatment ophthalmology",
        "high blood sugar": "hyperglycemia management diabetes",
        "high blood pressure": "hypertension management treatment",
        "sneezing": "allergic rhinitis treatment antihistamines",
        "wheezing": "wheezing treatment bronchodilator asthma"
    };
    
    for (const [symptom, searchTerm] of Object.entries(symptomToSearchTerm)) {
        if (userMessageLower.includes(symptom)) {
            return searchTerm;
        }
    }
    
    // Default search terms (original implementation)
    const healthTerms = [
        'health', 'medical', 'wellness', 'treatment', 'symptoms',
        'medicine', 'therapy', 'diagnosis', 'care', 'remedy',
        'exercise', 'nutrition', 'diet', 'fitness', 'mental health'
    ];
    
    // Try to extract medical conditions or symptoms from the user message
    const commonConditions = [
        'headache', 'migraine', 'fever', 'cough', 'cold', 'flu', 
        'allergy', 'pain', 'diabetes', 'hypertension', 'anxiety',
        'depression', 'insomnia', 'arthritis', 'asthma', 'obesity',
        'heart disease', 'cancer', 'stroke', 'alzheimer'
    ];
    
    for (const condition of commonConditions) {
        if (userMessageLower.includes(condition)) {
            return `${condition} treatment health information`;
        }
    }
    
    // If no specific condition found, look for health terms
    for (const term of healthTerms) {
        if (userMessageLower.includes(term)) {
            return `${term} health information`;
        }
    }
    
    // Default fallback: extract first 3-5 words from the user query
    const words = userMessageLower.split(' ').filter(w => w.length > 3).slice(0, 5);
    if (words.length > 0) {
        return `${words.join(' ')} health information`;
    }
    
    return 'general health information';
}

async function searchYouTubeVideos(searchTerm) {
    try {
        const response = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
                key: YOUTUBE_API_KEY,
                q: searchTerm,
                part: 'snippet',
                maxResults: 3,
                type: 'video',
                videoEmbeddable: true,
                relevanceLanguage: 'en'
            }
        });

        // Format response to match what the frontend expects
        return response.data.items.map(item => ({
            id: { videoId: item.id.videoId }, // This structure matches what the frontend expects
            snippet: {
                title: item.snippet.title,
                description: item.snippet.description,
                thumbnails: item.snippet.thumbnails
            }
        }));
    } catch (error) {
        console.error('Error searching YouTube videos:', error);
        if (error.response && error.response.data) {
            console.error('YouTube API error details:', error.response.data);
        }
        return [];
    }
}

// Start the server
app.listen(PORT, () => {
    console.log(`MediAssist server running on port ${PORT}`);
    console.log(`Access the chatbot at http://localhost:${PORT}/chatbot`);
});