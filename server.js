var express = require('express');
var app = express();
var auth = require('./lib/login');
var alexa = require('./lib/alexa');
var record = require('node-record-lpcm16');
var fs = require('fs');


const CLIENT_ID = "amzn1.application-oa2-client.260a064eafa04546975feb9ac1e557c6";
const CLIENT_SECRET = "0b797e70c68504f49fdf34bbbe1901e3db200d0c77f90487dc22b04170488fd7";
const REDIRECT = "http://richard-ive.ddns.net:5006/authresponse";
const SCOPE_DATA = JSON.stringify({"alexa:all":{"productID":"my_device","productInstanceAttributes":{"deviceSerialNumber":"12345"}}});

app.get('/login', (req, res) => {
  if(!auth.isLoggedIn()){
    res.redirect(`https://www.amazon.com/ap/oa?client_id=${CLIENT_ID}&scope=alexa:all&scope_data=${SCOPE_DATA}&response_type=code&redirect_uri=${REDIRECT}`);    
  }else{
    res.end("You're already logged in my friend!");
  }
  
});

var TOKEN = "";
app.get('/authresponse', (req, res) => {

  auth.login(req.query.code);
  auth.on('success', (auth) => {
    TOKEN = auth.access_token;
    res.end('<a href="/listen">listen</a> Welcome! ' + auth.access_token);
  });

});

app.get('/listen', (req, res) => {

  alexa.listen(TOKEN);

  alexa.on('done', () => {
    res.end('<a href="/listen">Listen Again</a>');
  });

});

app.listen(5006,  () => {
  console.log('Example app listening on port 5006!');
});
