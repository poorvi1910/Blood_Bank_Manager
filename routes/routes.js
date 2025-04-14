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

    if (!role) {
        return res.status(400).send("Role (user or admin) is required.");
    }
    if (role !== 'user' && role !== 'admin') {
         return res.status(400).send("Invalid role specified.");
    }

    try {
        if (role === 'user') {
            // Extract fields based on the names used in register.ejs for userFields
            const { d_name, d_dob, d_gender, d_bloodGroup, d_phoneNo, d_address, healthStatus, lastDonationDate, weight, password } = req.body;

            // Validate required fields explicitly on server-side as well
            if (!d_name || !d_dob || !d_gender || !d_bloodGroup || !d_phoneNo || !d_address || !healthStatus || !weight || !password) {
                 return res.status(400).send("Missing required donor information.");
            }

            const query = `BEGIN REGISTER_DONOR(:d_name, :d_phoneNo, :password, :d_dob, :d_gender, :d_bloodGroup, :d_address, :healthStatus, :lastDonationDate, :weight); END;`;
            const binds = {
                d_name,
                d_phoneNo,
                password, // Pass password directly (consider hashing!)
                d_dob, // Should be in 'YYYY-MM-DD' format from <input type="date">
                d_gender,
                d_bloodGroup,
                d_address,
                healthStatus,
                lastDonationDate: lastDonationDate || null, // Handle optional date - pass null if empty
                weight: parseFloat(weight) // Ensure weight is a number
             };

            console.log("Registering donor with:", binds); // Be cautious logging passwords even during dev
            await executeQuery(query, binds);
            console.log("Donor registered successfully.");
            res.redirect('/'); // Redirect to login page after successful registration

        } else if (role === 'admin') {
            // Extract fields based on the names used in register.ejs for adminFields
            const { a_name, bloodBankID, a_address, a_phoneNo, password } = req.body;

             // Validate required fields
            if (!a_name || !bloodBankID || !a_address || !a_phoneNo || !password) {
                 return res.status(400).send("Missing required admin information.");
            }

            const query = `BEGIN REGISTER_ADMIN(:a_name, :bloodBankID, :a_address, :a_phoneNo, :password); END;`;
            const binds = {
                a_name,
                bloodBankID: parseInt(bloodBankID, 10), // Ensure BloodBankID is a number
                a_address,
                a_phoneNo,
                password // Pass password directly (consider hashing!)
            };
            console.log("Registering admin with:", binds); // Be cautious logging passwords
            await executeQuery(query, binds);
            console.log("Admin registered successfully.");
            res.redirect('/'); // Redirect to login page
        }
        // No else needed due to prior validation

    } catch (err) {
        console.error("Registration Error:", err);
        // Provide more specific feedback if possible (e.g., check for unique constraint errors)
        if (err.errorNum === 1) { // ORA-00001: unique constraint violated
             res.status(409).send("Registration failed. A user or admin with some of these details (e.g., phone, name) might already exist.");
        } else if (err.errorNum === 2291) { // ORA-02291: integrity constraint violated - parent key not found (e.g., invalid BloodBankID)
             res.status(400).send("Registration failed. Invalid data provided (e.g., the specified Blood Bank ID does not exist).");
        }
         else {
             res.status(500).send("Registration failed due to a server error. Please try again later.");
        }
    }
});

// Donor Login
router.post('/login', async (req, res) => {
    // 'name' comes from the form input name="name"
    const { name, password } = req.body;

     if (!name || !password) {
        return res.status(400).send("Username and Password are required.");
    }

    try {
        const query = `BEGIN LOGIN_DONOR(:d_name, :password, :is_valid); END;`;
        const binds = {
            d_name: name, // Map form 'name' to procedure parameter p_d_name
            password: password,
            is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };

        const result = await executeQuery(query, binds);
        if (result.outBinds && result.outBinds.is_valid === 1) {
            // Add session logic here if needed
            console.log(`Donor login successful: ${name}`);
            res.render('home'); // Redirect to donor dashboard/page
        } else {
            console.log(`Donor login failed: ${name}`);
            // Send back to login with an error message (more user-friendly)
            // For now, just sending text
             res.status(401).send("Invalid Donor Credentials");
        }
    } catch (err) {
        console.error("Donor Login Error:", err);
        res.status(500).send("Login failed due to a server error.");
    }
});


// Admin Login
router.post('/admin-login', async (req, res) => {
    // 'name' comes from the form input name="name"
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).send("Username and Password are required.");
    }

    try {
        const query = `BEGIN LOGIN_ADMIN(:a_name, :password, :is_valid); END;`;
        const binds = {
            a_name: name, // Map form 'name' to procedure parameter p_a_name
            password: password,
            is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        };

        const result = await executeQuery(query, binds);
        if (result.outBinds && result.outBinds.is_valid === 1) {
            // Add session logic here if needed
            console.log(`Admin login successful: ${name}`);
            res.render('admin'); // Render admin dashboard
        } else {
             console.log(`Admin login failed: ${name}`);
             res.status(401).send("Invalid Admin Credentials");
        }
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.status(500).send("Login failed due to a server error.");
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
    // Add authentication check here (e.g., check session)
    // Fetch admin-specific data if needed
    res.render('admin'); // Assuming admin.ejs exists
});

// Basic logout (requires session middleware like express-session)
router.post('/logout', (req, res) => {
    // if (req.session) {
    //     req.session.destroy(err => {
    //         if (err) {
    //             console.error("Session destruction error:", err);
    //             return res.status(500).send("Could not log out.");
    //         } else {
    //              console.log('User logged out');
    //              res.redirect('/');
    //         }
    //     });
    // } else {
    //      res.redirect('/'); // No session to destroy
    // }
     console.log('Logout requested (session handling not fully implemented)');
     res.redirect('/'); // Simple redirect for now
});

module.exports = router;