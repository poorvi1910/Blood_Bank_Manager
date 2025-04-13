const express = require('express');
const router = express.Router();
const { executeQuery } = require('../db/db');
const oracledb = require('oracledb');
const { initializeProcedures } = require('../db/procedures');

initializeProcedures();

router.get('/', (req, res) => {
    res.render('index');
});

router.get('/register', (req, res) => {
    res.render('register');
});

router.post('/register', async (req, res) => {
    const { role } = req.body;
    
    try {
        if (role === 'user') {
            const { name, dob, gender, bloodGroup, phone, address, healthStatus, lastDonationDate, weight, password } = req.body;
            const query = `BEGIN REGISTER_DONOR(:name, :phone, :password, :dob, :gender, :bloodGroup, :address, :healthStatus, :lastDonationDate, :weight); END;`;
            const binds = {name,phone,password,dob,gender,bloodGroup,address,healthStatus,lastDonationDate,weight: parseFloat(weight) };
            
            console.log("Registering donor with:", binds);
            await executeQuery(query, binds);
            res.redirect('/');
            
        } else if (role === 'admin') {
            const { name, bloodBankID, address, phone, password } = req.body;
            const query = `BEGIN REGISTER_ADMIN(:name, :bloodBankID, :address, :phone, :password); END;`;
            const binds = {name,bloodBankID,address,phone,password};
            console.log("Registering admin with:", binds);
            await executeQuery(query, binds);
            res.redirect('/');
        } else {
            res.status(400).send("Invalid role selected");
        }
    } catch (err) {
        console.error("Registration Error:", err);
        res.status(500).send("Registration failed. Please try again.");
    }
});

// Donor Login
router.post('/login', async (req, res) => {
    const { name, password } = req.body;

    try {
        const query = `BEGIN LOGIN_DONOR(:name, :password, :is_valid); END;`;
        const binds = {
            name,
            password,
            is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };

        const result = await executeQuery(query, binds);
        if (result.outBinds.is_valid === 1) {
            res.render('home'); // Redirect to donor dashboard
        } else {
            res.send("Invalid Donor Credentials");
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.sendStatus(500);
    }
});


// Admin Login
router.post('/admin-login', async (req, res) => {
    const { name, password } = req.body; // change from username to name

    try {
        const query = `BEGIN LOGIN_ADMIN(:name, :password, :is_valid); END;`;
        const binds = {
            name,
            password,
            is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };

        const result = await executeQuery(query, binds);
        if (result.outBinds.is_valid === 1) {
            res.render('admin');
        } else {
            res.send("Invalid Admin Credentials");
        }
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.sendStatus(500);
    }
});


router.get('/donor', async (req, res) => {
    try {
        res.render('donor');
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
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
    req.session = null;
    console.log('User logged out');
    res.redirect('/');
});

module.exports = router;
