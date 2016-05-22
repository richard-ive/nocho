const express = require('express');
const app = express();
const auth = require('./lib/login');
const alexa = require('./lib/alexa');
const record = require('node-record-lpcm16');
const fs = require('fs');
const conf = require('./conf/conf');

const SCOPE_DATA = JSON.stringify({"alexa:all":{"productID":"my_device","productInstanceAttributes":{"deviceSerialNumber":"12345"}}});

app.get('/login', (req, res) => {
  if(!auth.isLoggedIn()){
    res.redirect(`https://www.amazon.com/ap/oa?client_id=${conf.CLIENT_ID}&scope=alexa:all&scope_data=${SCOPE_DATA}&response_type=code&redirect_uri=${conf.REDIRECT}`);    
  }else{
    res.end("You're already logged in my friend!");
  }
  
});

app.get('/authresponse', (req, res) => {

  auth.login(req.query.code);
  auth.on('success', (auth) => {
    alexa.ping(auth.access_token);
    res.end('<a href="/listen">listen</a>');
  });

});

app.get('/listen', (req, res) => {

  alexa.listen(auth.access_token);
  alexa.on('done', () => {
    res.end('<a href="/listen">Listen Again</a>');
  });

});

app.listen(5006,  () => {
  console.log('Example app listening on port 5006!');
});
