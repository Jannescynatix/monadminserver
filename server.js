// server.js
const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Wird nur für den Vergleich verwendet, da Hash im Klartext

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(express.json());
app.use(cors({
    origin: '*', // Erlaubt Anfragen von jeder Domain
    methods: ['GET', 'POST']
}));

// --- MongoDB Verbindung ---
const mongoUri = process.env.MONGODB_URI;
let client;
let db;

async function connectToMongo() {
    try {
        if (!mongoUri) {
            console.error('Fehler: MONGODB_URI Umgebungsvariable ist nicht gesetzt.');
            process.exit(1);
        }
        client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db('ai_text_detector_db');
        console.log("Verbunden mit MongoDB.");
    } catch (error) {
        console.error("Fehler beim Verbinden mit MongoDB:", error);
        process.exit(1);
    }
}
connectToMongo();

// --- Login-Credentials (aus Umgebungsvariablen) ---
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- Middleware zur Authentifizierung ---
function authenticateAdmin(req, res, next) {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.isAuthenticated = true;
        next();
    } else {
        res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten.' });
    }
}

// --- API Endpunkte ---

// Loggt Besuche, Klicks und Admin-Aktionen
app.post('/log', async (req, res) => {
    const { event, details } = req.body;
    if (!event) {
        return res.status(400).json({ message: 'Ereignis-Typ fehlt.' });
    }
    const logData = {
        timestamp: new Date(),
        event: event,
        details: details,
    };
    try {
        const collection = db.collection('website_analytics');
        await collection.insertOne(logData);
        res.status(200).json({ message: 'Ereignis erfolgreich protokolliert.' });
    } catch (error) {
        console.error('Fehler beim Speichern des Protokolls:', error);
        res.status(500).json({ message: 'Interner Serverfehler.' });
    }
});

// Admin-Login-Endpunkt
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    const adminLogsCollection = db.collection('website_analytics');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        adminLogsCollection.insertOne({
            timestamp: new Date(),
            event: 'admin_login_success',
            details: { username: username, ip: req.ip, userAgent: req.headers['user-agent'] }
        });
        res.status(200).json({ success: true, message: 'Login erfolgreich.' });
    } else {
        adminLogsCollection.insertOne({
            timestamp: new Date(),
            event: 'admin_login_failure',
            details: { username: username, ip: req.ip }
        });
        res.status(401).json({ success: false, message: 'Ungültige Anmeldedaten.' });
    }
});

// Daten für das Admin-Dashboard abrufen
app.get('/admin/data', async (req, res) => {
    // Einfache Authentifizierung für diese Demo (im echten System durch Token ersetzen)
    const { username, password } = req.query; // Query-Parameter für GET
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Nicht autorisiert.' });
    }
    try {
        const collection = db.collection('website_analytics');
        const analytics = await collection.find({}).sort({ timestamp: -1 }).toArray();
        res.status(200).json({ success: true, analytics });
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).json({ message: 'Interner Serverfehler.' });
    }
});

// Startet den Server
app.listen(port, () => {
    console.log(`Analytics-Server läuft auf Port ${port}`);
});