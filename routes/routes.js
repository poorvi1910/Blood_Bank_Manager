// routes.js
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
            const { d_name, d_dob, d_gender, d_bloodGroup, d_phoneNo, d_address, healthStatus, lastDonationDate, weight, password } = req.body;

            if (!d_name || !d_dob || !d_gender || !d_bloodGroup || !d_phoneNo || !d_address || !healthStatus || !weight || !password) {
                return res.status(400).send("Missing required donor information.");
            }

            // Additional check for valid DOB format
            const dobDate = new Date(d_dob);
            if (isNaN(dobDate)) {
                return res.status(400).send("Invalid date format for Date of Birth.");
            }

            const query = `BEGIN REGISTER_DONOR(:d_name, :d_phoneNo, :password, :d_dob, :d_gender, :d_bloodGroup, :d_address, :healthStatus, :lastDonationDate, :weight); END;`;
            const binds = {
                d_name, d_phoneNo, password, d_dob, d_gender, d_bloodGroup, d_address, healthStatus,
                lastDonationDate: lastDonationDate || null,
                weight: parseFloat(weight)
            };

            // Execute the query to register the donor
            await executeQuery(query, binds);
            console.log("Donor registered successfully.");
            res.redirect('/');

        } else if (role === 'admin') {
            const { a_name, bloodBankID, a_address, a_phoneNo, password, bankPassword } = req.body;
        
            if (!a_name || !bloodBankID || !a_address || !a_phoneNo || !password || !bankPassword) {
                return res.status(400).send("Missing required admin information or blood bank password.");
            }
        
            const bankPasswordQuery = `SELECT Password FROM BloodBank WHERE BloodBankID = :bloodBankID`;
            const result = await executeQuery(bankPasswordQuery, { bloodBankID: parseInt(bloodBankID, 10) });
        
            if (!result.rows || result.rows.length === 0) {
                return res.status(400).send("Invalid Blood Bank ID.");
            }

            const correctBankPassword = result.rows[0][0];
            if (bankPassword !== correctBankPassword) {
                return res.status(401).send("Incorrect Blood Bank password. Registration denied.");
            }
        
            const registerQuery = `BEGIN REGISTER_ADMIN(:a_name, :bloodBankID, :a_address, :a_phoneNo, :password); END;`;
            const binds = {
                a_name,
                bloodBankID: parseInt(bloodBankID, 10),
                a_address,
                a_phoneNo,
                password,
            };
        
            await executeQuery(registerQuery, binds);
            console.log("Admin registered successfully.");
            res.redirect('/');
        }

    } catch (err) {
        console.error("Registration Error:", err);
        if (err.errorNum === 20001) {
            return res.status(400).send(err.message.replace("ORA-20001: ", "")); // Extract and show the custom age error message
        }
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
      const query = `BEGIN LOGIN_DONOR(:d_name, :password, :is_valid, :donor_id); END;`;
      const binds = {
          d_name: name,
          password: password,
          is_valid: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          donor_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      };
      const result = await executeQuery(query, binds);

      if (result.outBinds && result.outBinds.is_valid === 1) {
          req.session.userId = result.outBinds.donor_id; // Store DonorID in session
          console.log(`Donor login successful: ${name}, DonorID: ${result.outBinds.donor_id}`);
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
                
                const bloodBankResult = await executeQuery(
                    `SELECT BloodBankID FROM Administrators WHERE A_Name = :name`,
                    [name],
                    { outFormat: oracledb.OUT_FORMAT_OBJECT }
                );
                
                const bloodBankId = bloodBankResult.rows[0]?.BLOODBANKID;
                if (!bloodBankId) {
                    return res.status(500).send("Could not find Blood Bank ID for admin.");
                }

              req.session.adminBloodBankId = bloodBankId; // Already exists
              console.log("Blood Bank ID set in session:", req.session.adminBloodBankId);
            
                res.redirect('/admin');
            }
            
         else {
            console.log(`Admin login failed: ${name}`);
             res.render('index', { adminLoginError: 'Invalid Admin Credentials' }); 
        }
    } catch (err) {
        console.error("Admin Login Error:", err);
        res.status(500).send("Login failed due to a server error.");
    }
});

router.get('/donor', async (req, res) => {
  const donorId = req.session.userId;
  try {
      const [eventResult, bloodbankResult] = await Promise.all([
          executeQuery(`
              SELECT de.EventID, de.EventName, de.Location, de.EventDate, de.E_PhoneNo,
                     CASE WHEN EXISTS (
                         SELECT 1 FROM DonationInfo di WHERE di.EventID = de.EventID AND di.DonorID = :donorId
                     ) THEN 1 ELSE 0 END AS AlreadyDonated
              FROM DonationEvents de
              ORDER BY de.EventDate DESC
          `, { donorId }, { outFormat: oracledb.OUT_FORMAT_OBJECT }),

          executeQuery(`SELECT * FROM BloodBank`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT })
      ]);

      const events = eventResult.rows.map(event => ({
          ...event,
          EVENTDATE: event.EVENTDATE ? new Date(event.EVENTDATE).toLocaleDateString() : 'N/A'
      }));

      res.render('donor', { events, bloodbanks: bloodbankResult.rows });
  } catch (err) {
      console.error("Error fetching donor dashboard:", err);
      res.status(500).send("Error loading dashboard.");
  }
});

router.post('/donor/donate-event', async (req, res) => {
    const units = 1;
    const { eventId, bloodBankId } = req.body;
    const donorId = req.session.userId;
  
    if (!units || !donorId) {
        return res.status(400).json({ success: false, message: 'Missing input.' });
    }
  
    try {
        let finalBloodBankId = bloodBankId;
  
        if (eventId) {
            const eventResult = await executeQuery(
                `SELECT BloodBankID FROM DonationEvents WHERE EventID = :eventId`,
                { eventId }, { outFormat: oracledb.OUT_FORMAT_OBJECT }
            );
            if (!eventResult.rows.length) {
                return res.status(404).json({ success: false, message: 'Event not found.' });
            }
            finalBloodBankId = eventResult.rows[0].BLOODBANKID;
        }

        await executeQuery(`
            INSERT INTO DonationInfo (DonationID, BloodBankID, UnitsDonated, EventID, CollectionDate, DonorID, ExpiryDate)
            VALUES (DONATION_SEQ.NEXTVAL, :bloodBankId, :units, :eventId, SYSDATE, :donorId, SYSDATE + 42)
        `, {
            bloodBankId: finalBloodBankId,
            units,
            eventId: eventId || null,
            donorId
        }, { autoCommit: true });
  
        res.json({ success: true });
  
    } catch (err) {
        console.error("Donation error:", err);
  
        // Check for custom error raised by the trigger
        if (err.errorNum === 20001) {
            const reason = err.message.replace("ORA-20001: ", "");
          
            let customMessage = "You can't donate – ";
  
            if (reason.includes('HealthStatus')) {
                customMessage += "you're unhealthy.";
            } else if (reason.includes('LastDonation')) {
                customMessage += "your last donation was less than 2 months ago.";
            } else {
                customMessage += "you are not eligible to donate.";
            }
  
            return res.status(400).json({
                success: false,
                message: customMessage
            });
        }
        
        
        // Handle other potential errors
        res.status(500).json({ success: false, message: 'Server error.' });
    }
  });
  



router.get('/admindonor', async (req, res) => {
    try {
        const bloodBankId = req.session.adminBloodBankId;
        if (!bloodBankId) {
            return res.status(403).send("Unauthorized access: no blood bank ID in session.");
        }

        const directDonationsQuery = `
            SELECT * FROM DonationInfo d
            JOIN Donors do ON d.donorid = do.donorid
            WHERE d.EventID IS NULL AND d.BloodBankID = :bbid
        `;

        const eventDonationsQuery = `
            SELECT * FROM DonationInfo d
            JOIN Donors do ON d.donorid = do.donorid
            WHERE d.EventID IS NOT NULL AND d.BloodBankID = :bbid
        `;

        const [directResult, eventResult] = await Promise.all([
            executeQuery(directDonationsQuery, { bbid: bloodBankId }, { outFormat: oracledb.OUT_FORMAT_OBJECT }),
            executeQuery(eventDonationsQuery, { bbid: bloodBankId }, { outFormat: oracledb.OUT_FORMAT_OBJECT }),
        ]);

        console.log("Direct Donations:", directResult.rows);
        console.log("Event Donations:", eventResult.rows);

        res.render('admindonor', {
            directDonations: directResult.rows,
            eventDonations: eventResult.rows
        });
    } catch (err) {
        console.error("Error loading admin donor requests:", err);
        res.status(500).send("Failed to load donation requests.");
    }
});


router.get('/adminreceiver', async (req, res) => {
    try {
        const bloodBankId = req.session.adminBloodBankId;
        if (!bloodBankId) {
            return res.status(403).send("Unauthorized access: no blood bank ID in session.");
        }

        const receivalRequestsQuery = `
            SELECT r.RECIPIENTID, r.R_NAME, r.R_DOB, r.R_GENDER, r.R_BLOODGROUP,
                   r.R_PHONENO, r.R_ADDRESS, r.REASONFORREQUEST, r.SEVERITY,
                   r.REQUIREDUNITS
            FROM RECIPIENTS r
           
        `;

        const result = await executeQuery(
            receivalRequestsQuery,
            {},
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        console.log("Receival Requests:", result.rows);

        res.render('adminreceiver', {
            receivalRequests: result.rows
        });

    } catch (err) {
        console.error("Error loading receival requests:", err);
        res.status(500).send("Failed to load receival requests.");
    }
});


router.post('/admin/check-inventory', async (req, res) => {
    const { recipientID, requiredUnits, recipientBloodGroup } = req.body;
    console.log("Received body:", req.body);
  
    const bloodBankId = req.session.adminBloodBankId;
    console.log("Blood bank ID in session:", bloodBankId);
  
    if (!bloodBankId) {
      return res.status(403).send("Unauthorized: no blood bank ID in session.");
    }
  
    // Blood compatibility mapping
    const compatible = {
      'O-': ['O-','O+','A-','A+','B-','B+','AB-','AB+'],
      'O+': ['O+','A+','B+','AB+'],
      'A-': ['A-','A+','AB-','AB+'],
      'A+': ['A+','AB+'],
      'B-': ['B-','B+','AB-','AB+'],
      'B+': ['B+','AB+'],
      'AB-': ['AB-','AB+'],
      'AB+': ['AB+']
    };
    const compatibleTypes = Object.entries(compatible)
      .filter(([donorType, canDonateTo]) => canDonateTo.includes(recipientBloodGroup))
      .map(([donorType]) => donorType);
  
    if (!compatibleTypes.length) {
      return res.status(400).send("Invalid blood group.");
    }
  
    try {
      const sql = `
        SELECT SUM(d.UNITSDONATED) AS TOTAL_UNITS
        FROM DonationInfo d
        JOIN Donors do ON d.DonorID = do.DonorID
        WHERE d.BLOODBANKID = :bbid
        AND do.D_BloodGroup IN (${compatibleTypes.map(t => `'${t}'`).join(',')})
      `;
  
      const binds = { bbid: bloodBankId };
      const result = await executeQuery(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const totalUnits = result.rows[0].TOTAL_UNITS || 0;
  
      console.log("Total available units:", totalUnits);
  
      if (totalUnits >= Number(requiredUnits)) {
        res.json({ success: true, message: "Sufficient units available." });
      } else {
        res.json({ success: false, message: "Insufficient units available." });
      }
    } catch (err) {
      console.error("Error in check-inventory:", err);
      res.status(500).send("Internal server error: " + err.message);
    }
  });
  

  router.post('/admin/review-receival', async (req, res) => {
    const { recipientId, action } = req.body;
    const bloodBankId = req.session.adminBloodBankId;
    console.log("Receival Review Request ->", { recipientId, action, bloodBankId });
  
    if (!recipientId || !action || !bloodBankId) {
      return res.status(400).json({ success: false, message: 'Missing required information.' });
    }
  
    try {
      const recipientQuery = `
        SELECT RECIPIENTID, R_BLOODGROUP, REQUIREDUNITS
        FROM RECIPIENTS
        WHERE RECIPIENTID = :recipientId
      `;
      const recipientResult = await executeQuery(
        recipientQuery,
        { recipientId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const recipient = recipientResult.rows[0];
      if (!recipient) return res.json({ success: false, message: 'Recipient not found.' });
  
      if (action === 'reject') {
        return res.json({ success: true, message: 'Request rejected.' });
      }
  
      // Compatibility
      const compatibleMap = {
        'O-': ['O-'], 'O+': ['O-','O+'], 'A-': ['O-','A-'],
        'A+': ['O-','O+','A-','A+'], 'B-': ['O-','B-'],
        'B+': ['O-','O+','B-','B+'], 'AB-': ['O-','A-','B-','AB-'],
        'AB+': ['O-','O+','A-','A+','B-','B+','AB-','AB+']
      };
      const compatibleTypes = compatibleMap[recipient.R_BLOODGROUP] || [];
  
      const donationQuery = `
        SELECT d.DONATIONID, d.UNITSDONATED
        FROM DONATIONINFO d
        JOIN DONORS do ON d.donorid = do.donorid
        WHERE d.BLOODBANKID = :bbid
          AND do.D_BLOODGROUP IN (${compatibleTypes.map((_, i) => `:b${i}`).join(',')})
          AND d.UNITSDONATED > 0
        ORDER BY d.DONATIONID
      `;
      const binds = Object.assign(
        { bbid: bloodBankId },
        Object.fromEntries(compatibleTypes.map((t, i) => [`b${i}`, t]))
      );
  
      const donationResult = await executeQuery(donationQuery, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const donations = donationResult.rows;
  
      if (!donations.length) {
        return res.json({ success: false, message: 'No compatible donations available.' });
      }
  
      // Start accumulating donations
      let unitsNeeded = recipient.REQUIREDUNITS;
      let allocations = [];
  
      for (let d of donations) {
        if (unitsNeeded <= 0) break;
        const useUnits = Math.min(d.UNITSDONATED, unitsNeeded);
        allocations.push({ donationId: d.DONATIONID, unitsUsed: useUnits });
        unitsNeeded -= useUnits;
      }
  
      if (unitsNeeded > 0) {
        return res.json({ success: false, message: 'Insufficient total compatible units.' });
      }
  
      // Perform updates inside transaction
      const connection = await oracledb.getConnection({
        user: "C##user1",
        password: "pass1",
        connectString: "localhost:1521/XE"
      });
  
      try {
        for (let alloc of allocations) {
          await connection.execute(
            `UPDATE DONATIONINFO SET UNITSDONATED = UNITSDONATED - :used WHERE DONATIONID = :id`,
            { used: alloc.unitsUsed, id: alloc.donationId }
          );
        }
  
        await connection.execute(
          `INSERT INTO RECEIVINGINFO (
             RECEIVALID, RECIPIENTID, BLOODBANKID,
             UNITSRECEIVED, RECEIVALDATE
           ) VALUES (
             RECEIVAL_SEQ.NEXTVAL, :recipientId, :bbid, :units, SYSDATE
           )`,
          {
            recipientId,
            bbid: bloodBankId,
            units: recipient.REQUIREDUNITS
          }
        );
  
        await connection.execute('COMMIT');
        await connection.close();
  
        return res.json({ success: true, message: 'Request accepted and units allocated.' });
      } catch (errTx) {
        await connection.execute('ROLLBACK');
        await connection.close();
        console.error('Transaction error:', errTx);
        return res.json({ success: false, message: 'Transaction failed.' });
      }
  
    } catch (err) {
      console.error('Review error:', err);
      return res.status(500).json({ success: false, message: 'Server error during review.' });
    }
  });
  
  
  router.get('/receiver', async (req, res) => {
    const donorId = req.session.userId;

    if (!donorId) {
        return res.status(403).send("Unauthorized access. Please log in.");
    }

    try {
        const [donorResult, bloodbankResult] = await Promise.all([
            executeQuery(
                `SELECT D_NAME, D_DOB, D_GENDER, D_BLOODGROUP, D_PHONENO, D_ADDRESS FROM DONORS WHERE DONORID = :id`,
                { id: donorId },
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            ),
            executeQuery(
                `SELECT * FROM BLOODBANK`,
                {},
                { outFormat: oracledb.OUT_FORMAT_OBJECT }
            )
        ]);

        if (!donorResult.rows.length) {
            return res.status(404).send("Donor not found.");
        }

        res.render('receiver', {
            donor: donorResult.rows[0],
            bloodbanks: bloodbankResult.rows
        });
    } catch (err) {
        console.error("Receiver Page Error:", err);
        res.status(500).send("Internal Server Error");
    }
});

router.post('/receiver/request', async (req, res) => {
    const {
        r_name, r_dob, r_gender, r_bloodGroup,
        r_phoneNo, r_address, reasonForRequest,
        severity, requiredUnits
    } = req.body;

    try {
        await executeQuery(`
            INSERT INTO Recipients (
                RecipientID, R_Name, R_DOB, R_Gender, R_BloodGroup, R_PhoneNo,
                R_Address, ReasonForRequest, Severity, RequiredUnits
            ) VALUES (
                RECIPIENT_SEQ.NEXTVAL, :r_name, TO_DATE(:r_dob, 'YYYY-MM-DD'), :r_gender, :r_bloodGroup, :r_phoneNo,
                :r_address, :reasonForRequest, :severity, :requiredUnits
            )
        `, {
            r_name, r_dob, r_gender, r_bloodGroup, r_phoneNo,
            r_address, reasonForRequest, severity: parseInt(severity), requiredUnits: parseInt(requiredUnits)
        }, { autoCommit: true });

        res.redirect('/receiver');
    } catch (err) {
        console.error('Recipient insert error:', err);
        res.status(500).send("Failed to submit blood request.");
    }
});


router.get('/admin', (req, res) => {
    res.render('admin'); 
});

router.post('/logout', (req, res) => {
     console.log('Logout requested (session handling not fully implemented)');
     res.redirect('/'); 
});
router.post('/admin/review-donation', async (req, res) => {
    const { donationId, action } = req.body;

    try {
        if (action === 'reject') {
            console.log('Deleting Donation ID:', donationId);

            const result = await executeQuery(
                `DELETE FROM DonationInfo WHERE DONATIONID = :id`,
                { id: donationId },
                { autoCommit: true }  // this will commit immediately
            );

            console.log('Rows deleted:', result.rowsAffected);
        }

        // You can add handling for "accept" action here if needed
        res.json({ success: true });

    } catch (err) {
        console.error('Error handling review:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});



module.exports = router;