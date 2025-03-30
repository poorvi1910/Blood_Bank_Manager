const express=require('express');
const router=express.Router();
const { executeQuery } = require('../db/db');
const oracledb = require('oracledb');

async function createProcedure() {
    const procQuery = `
        CREATE OR REPLACE PROCEDURE GET_USERS(users OUT SYS_REFCURSOR) 
        AS 
        BEGIN 
            OPEN users FOR 
            SELECT ID, USERNAME, PASSWORD FROM users; 
        END;
    `;
    
    try {
        await executeQuery(procQuery, {});
        console.log("Stored Procedure 'GET_USERS' created successfully.");
    } catch (err) {
        console.error("Error creating stored procedure:", err);
    }
}
createProcedure();

router.get('/', (req, res)=>{
    res.render('index');
})

router.post('/login',async(req,res)=>{
    try{
        const {username, password}=req.body;
        const query = `SELECT * FROM users WHERE username = :username AND password = :password`;
        const result = await executeQuery(query, { username, password });

        if (result.rows.length > 0) {
            res.render("home");
        } else {
            res.send("Invalid Credentials");
        }
    } catch (err) {
        console.error("Login Error:", err);
        res.sendStatus(500);
    }
})

router.get('/donor', async (req, res) => {
    try {
        const query = `BEGIN GET_USERS(:users); END;`;
        const binds = { users: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } };
        const options = { outFormat: oracledb.OUT_FORMAT_OBJECT };
        const { result, connection } = await executeQuery(query, binds, options, true);
        
        try {
            const cursor = result.outBinds.users;
            const users = await cursor.getRows(1000);
            await cursor.close();
            
            console.log("Fetched Users:", users);
            res.render('donor', { users });
        } finally {
            if (connection) {
                try {
                    await connection.close();
                } catch (err) {
                    console.error("Error closing connection:", err);
                }
            }
        }
    } catch (err) {
        console.error("Error fetching users:", err);
        res.sendStatus(500);
    }
});


router.get('/receiver', async(req,res)=>{
    try{
        res.render('receiver')
    }
    catch(err){
        console.log(err);
        res.sendStatus(500);
    }
})

router.post('/logout', (req, res) => {
    req.session = null;
    console.log('User logged out');
    res.redirect('/');
  });

module.exports=router;