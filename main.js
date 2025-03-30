require("dotenv").config();
const express=require("express");
const app=express();
const session = require('express-session');
const PORT =process.env.PORT || 4000;

app.use(express.urlencoded({extended: true}))
app.use(express.json())
app.use(session({
    secret: 'finD#74N$*ce8bB#*9HeizrjapUGSG83?><w@',
    resave: false,
    saveUninitialized: false,
      cookie: { secure: false, maxAge: 600000 },
    })
  );
app.use('/',require("./routes/routes"));
app.set('view engine', 'ejs');

app.listen(PORT, ()=>{
    console.log(`Server started at http://localhost:${PORT}`);
});

app.use(express.static('css'));
app.use(express.static('scripts'));