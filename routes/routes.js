const express=require('express');
const router=express.Router();
const { executeQuery } = require('../db/db');

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

module.exports=router;