const express=require('express');
const router=express.Router();

router.get('/', (req, res)=>{
    res.render('index');
})

router.get('/login',(req,res)=>{
    
})

module.exports=router;