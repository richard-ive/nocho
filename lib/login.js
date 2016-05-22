const https = require('https');
const http2 = require('http2');
const util = require('util');
const querystring = require('querystring');
const moment = require('moment');
const conf = require('../conf/conf');

const BOUNDARY = 'BOUNDARY1234';
const BOUNDARY_DASHES = '--';
const NEWLINE = '\r\n';
const METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
const METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
const AUDIO_CONTENT_TYPE = 'Content-Type: application/octet-stream';
const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';

function Login(){

    var  access_token,  //"Atza|IQEBLjAsAhRBejiZKPfn5HO2562GBt26qt23EA",
    expires_in,         //3600,
    refresh_token,      //Atzr|IQEBLzAtAhUAibmh-1N0EsdqwqwdqdasdvferrE
    token_type,         //bearer
    refresh_interval;   //setInterval for token refresh

    var self = this;

    this.login = function(code, isRefresh = false){

        const options = {
            host: 'api.amazon.com',
            path: '/auth/o2/token',
            method: 'POST',
            headers : {
                  'Content-Type': 'application/x-www-form-urlencoded'
            }
        };

        var loginData;

        if(!isRefresh){

            loginData = querystring.stringify({
                grant_type: "authorization_code",
                code: code,
                client_id: conf.CLIENT_ID,
                client_secret: conf.CLIENT_SECRET,
                redirect_uri: conf.REDIRECT
            });

        }else{

            loginData = querystring.stringify({
                grant_type: "refresh_token",
                refresh_token: code,
                client_id: conf.CLIENT_ID,
                client_secret: conf.CLIENT_SECRET
            }); 

        }

        var loginReq = https.request(options, (response) => {

            var str = ''
            response.on('data', (chunk) => {
              str += chunk;
            });

            response.on('end', () => {
                var auth = JSON.parse(str);
                if(auth.access_token && !isRefresh)
                    self.downchannel(auth.access_token);
                    
                self.processAuth(auth); 
                
            });

        });

        loginReq.on('error', (err) => {
            console.log(err);
        });

        loginReq.write(loginData);
        loginReq.end();

    };

    this.processAuth = function(auth){

        //clearTimeout(self.refresh_interval);

        if(!self.access_token && auth.access_token){
            console.log(`Brand new token aquired`);

            self.emit('success', auth);
            self.refresh_interval = setTimeout(self.fetchNewToken, auth.expires_in * 300);
            console.log(moment().format("LTS"), "Fetching new token at " + moment().add(auth.expires_in * 300, "ms").format("LTS"));
        }else if(self.access_token && auth.access_token){
            console.log(`Refresh token aquired`);

            self.emit('refresh', auth);
            self.refresh_interval = setTimeout(self.fetchNewToken, auth.expires_in * 300);
            console.log(moment().format("LTS"), "Fetching new token at " + moment().add(auth.expires_in * 300, "ms").format("LTS"));
        }else{
            console.log('Uhoh');
            self.access_token = "";
            self.refresh_token = "";
        }

        self.expires_in = auth.expires_in;
        self.access_token = auth.access_token;
        self.refresh_token = auth.refresh_token;

    };

    this.fetchNewToken = function(){
        console.log('Fetching new token...');
        self.login(self.refresh_token, true);
    };

    this.isLoggedIn = function(){
        return self.refresh_token && self.access_token;
    };

    this.downchannel = function(token){

        const downChannelHeaders = {
            'Authorization' : `Bearer ${token}`
        };

        const downChannelOptions = {
            hostname: 'avs-alexa-na.amazon.com',
            port: 443,
            path: '/v20160207/directives',
            method: 'GET',
            headers: downChannelHeaders,
            encoding: 'binary',
            scheme: 'https'
        };

        console.log("Starting Down Channel");
        var downChannelReq = http2.request(downChannelOptions, (response) => {

            console.log(`Down channel respone status ${response.statusCode}`);
            self.sync(token);

        }).on('error', (err) => {
            console.log(err);
        });

    };


    this.sync = function (token){

        const syncHeaders = {
            'Authorization' : `Bearer ${token}`,
            'Content-Type' : 'multipart/form-data; boundary=' + BOUNDARY
        };

        const syncOptions = {
            hostname: 'avs-alexa-na.amazon.com',
            port: 443,
            path: '/v20160207/events',
            method: 'POST',
            headers: syncHeaders,
            encoding: 'binary',
            scheme: 'https'
        };


        console.log("Starting Sync");
        var syncReq = http2.request(syncOptions, (response) => {

            console.log(`Sync response status ${response.statusCode}`);

            var responseData = "";
            response.on('data', (chunk) => {
                responseData += chunk;
            });

            response.on('end', () => {
                console.log(responseData);
            });

        });

        syncReq.on('push', (pushRequest) => {
            console.log('Receiving pushed resource');
        }); 

        syncReq.on('error', (err) => {
            console.log(err);
        });


        var payload = {
            "context": [
            ],
            "event": {
                "header": {
                    "namespace": "System",
                    "name": "SynchronizeState",
                    "messageId": "message123"
                },
                "payload": {
                }
            }
        };

        var postSyncData = [
            NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE, METADATA_CONTENT_TYPE,
            NEWLINE, NEWLINE, JSON.stringify(payload, null, 2), NEWLINE, NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES
          ].join('');

        syncReq.write(postSyncData);
        syncReq.end();

    };


}

const EventEmitter = require('events').EventEmitter;
util.inherits(Login, EventEmitter);

module.exports = new Login;