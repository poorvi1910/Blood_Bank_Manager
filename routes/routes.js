// routes.js
const express = require('express');
const router = express.Router();
const { executeQuery } = require('../db/db');
const oracledb = require('oracledb');
const { initializeProcedures } = require('../db/procedures');
initializeProcedures();

function getLoggedInDonorId(req) {
    return 1;
}

router.get('/', (req, res) => {
    res.render('index');
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    const { role } = req.body;

    if (!role) {
        return res.status(400).send("Role (user or admin) is required.");
    }
    if (role !== 'user' && role !== 'admin') {
        return res.status(400).send("Invalid role specified.");
    }

    try {
        if (role === 'user') {
            const { d_name, d_dob, d_gender, d_bloodGroup, d_phoneNo, d_address, healthStatus, lastDonationDate, weight, password } = req.body;
            if (!d_name || !d_dob || !d_gender || !d_bloodGroup || !d_phoneNo || !d_address || !healthStatus || !weight || !password) {
                return res.status(400).send("Missing required donor information.");
            }
            const query = `BEGIN REGISTER_DONOR(:d_name, :d_phoneNo, :password, :d_dob, :d_gender, :d_bloodGroup, :d_address, :healthStatus, :lastDonationDate, :weight); END;`;
            const binds = {
                d_name, d_phoneNo, password, d_dob, d_gender, d_bloodGroup, d_address, healthStatus,
                lastDonationDate: lastDonationDate || null,
                weight: parseFloat(weight)
            };
            await executeQuery(query, binds);
            console.log("Donor registered successfully.");
            res.redirect('/');

        } else if (role === 'admin') {
            const { a_name, bloodBankID, a_address, a_phoneNo, password } = req.body;
            if (!a_name || !bloodBankID || !a_address || !a_phoneNo || !password) {
                return res.status(400).send("Missing required admin information.");
            }
            const query = `BEGIN REGISTER_ADMIN(:a_name, :bloodBankID, :a_address, :a_phoneNo, :password); END;`;
            const binds = {
                a_name, bloodBankID: parseInt(bloodBankID, 10), a_address, a_phoneNo, password
            };
            await executeQuery(query, binds);
            console.log("Admin registered successfully.");
            res.redirect('/');
        }

    } catch (err) {
        console.error("Registration Error:", err);
        if (err.errorNum === 1) {
            res.status(409).send("Registration failed. A user or admin with some of these details (e.g., phone, name) might already exist.");
        } else if (err.errorNum === 2291) {
            res.status(400).send("Registration failed. Invalid data provided (e.g., the specified Blood Bank ID does not exist).");
        } else {
            res.status(500).send("Registration failed due to a server error. Please try again later.");
        }
    }
});

router.post('/login', async (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        return res.status(400).send("Username and Password are required.");
    }
    try {
        const query = `BEGIN LOGIN_DONOR(:d_name, :password, :is_valid); END;`;
        const binds = {
            d_name: name, password: password,
            is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };
        const result = await executeQuery(query, binds);
        if (result.outBinds && result.outBinds.is_valid === 1) {
            console.log(`Donor login successful: ${name}`);
            res.render('home'); 
        } else {
            console.log(`Donor login failed: ${name}`);
             res.render('index', { loginError: 'Invalid Donor Credentials' }); 
        }
    } catch (err) {
        console.error("Donor Login Error:", err);
        res.status(500).send("Login failed due to a server error.");
    }
});

router.post('/admin-login', async (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) {
        return res.status(400).send("Username and Password are required.");
    }
    try {
        const query = `BEGIN LOGIN_ADMIN(:a_name, :password, :is_valid); END;`;
        const binds = {
            a_name: name, password: password,
            is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };
        const result = await executeQuery(query, binds);
        if (result.outBinds && result.outBinds.is_valid === 1) {
            console.log(`Admin login successful: ${name}`);
            res.redirect('/admin');
        } else {
            console.log(`Admin login failed: ${name}`);
             res.render('index', { adminLoginError: 'Invalid Admin Credentials' }); 
        }
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.status(500).send("Login failed due to a server error.");
    }
});

router.get('/donor', async (req, res) => { 
    try {
        const eventQuery = `SELECT EventID, EventName, Location, EventDate, E_PhoneNo FROM DonationEvents ORDER BY EventDate DESC`;
        const eventResult = await executeQuery(eventQuery, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT }); 
        const events = eventResult.rows.map(event => ({
            ...event,
            EVENTDATE: event.EVENTDATE ? new Date(event.EVENTDATE).toLocaleDateString() : 'N/A' 
        }));
        res.render('donor', { events: events });

    } catch (err) {
        console.error("Error fetching donor page data:", err);
        res.status(500).send("Error loading donor page.");
    }
});

router.post('/donor/donate-event', async (req, res) => {
    const { eventId, units } = req.body;
    const donorId = getLoggedInDonorId(req); 

    if (!eventId || !units || !donorId) {
        return res.status(400).json({ success: false, message: 'Missing event ID, units, or donor information.' });
    }

    const unitsDonated = parseInt(units, 10);
    if (isNaN(unitsDonated) || unitsDonated <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid number of units specified.' });
    }

    try {
        console.log(`Received donation intent: DonorID ${donorId}, EventID ${eventId}, Units ${unitsDonated}`);
        res.json({ success: true, message: 'Donation submitted successfully!' });

    } catch (err) {
        console.error("Error processing donation submission:", err);
        res.status(500).json({ success: false, message: 'Server error processing donation.' });
    }
});


router.get('/receiver', async (req, res) => {
    try {
        res.render('receiver');
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});

router.get('/admin', (req, res) => {
    res.render('admin'); 
});

router.post('/logout', (req, res) => {
     console.log('Logout requested (session handling not fully implemented)');
     res.redirect('/'); 
});

module.exports = router;