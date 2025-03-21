require("dotenv").config();
const express=require("express");
const app=express();
const PORT =process.env.PORT || 4000;

app.use(express.urlencoded({extended: true}))
app.use(express.json())

app.use('/',require("./routes/routes"));
app.set('view engine', 'ejs');

app.listen(PORT, ()=>{
    console.log(`Server started at http://localhost:${PORT}`);
});

app.use(express.static('css'));
app.use(express.static('scripts'));