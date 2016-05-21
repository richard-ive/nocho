const http2 = require('http2');
const util = require('util');
const fs = require('fs');
const httpParser = require('http-message-parser');
const spawn = require('child_process').spawn;
const streamToBuffer = require('stream-to-buffer');
const record = require('node-record-lpcm16');
const conf = require('../conf/conf');

const BOUNDARY = 'BOUNDARY1234';
const BOUNDARY_DASHES = '--';
const NEWLINE = '\r\n';
const METADATA_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="metadata"';
const METADATA_CONTENT_TYPE = 'Content-Type: application/json; charset=UTF-8';
const AUDIO_CONTENT_TYPE = 'Content-Type: application/octet-stream';
const AUDIO_CONTENT_DISPOSITION = 'Content-Disposition: form-data; name="audio"';

function Alexa(){

  var self = this;
  var audioReq;

  this.hasValue = function(obj, key, value) {
    return obj.hasOwnProperty(key) && obj[key] === value;
  }

  this.listen = function(TOKEN){

    const audioHeaders = {
      'Authorization' : `Bearer ${TOKEN}`,
      'Content-Type' : 'multipart/form-data; boundary=' + BOUNDARY
    };

    const audioOptions = {
      hostname: 'avs-alexa-na.amazon.com',
      port: 443,
      path: '/v20160207/events',
      method: 'POST',
      headers: audioHeaders,
      encoding: 'binary',
      scheme: 'https'
    };


    console.log("Starting Audio");
    self.audioReq = http2.request(audioOptions, (response) => {

      console.log(response.statusCode);

      streamToBuffer(response, function (err, buffer) {

        if (err) {
          console.error('error', err);
          return false;
        }

        var errorCode;

        try {
          errorCode = JSON.parse(buffer.toString('utf8')).error.code;
          console.log(errorCode);
        } catch(e) {

        }

        const parsedMessage = httpParser(buffer);

        var multipart = parsedMessage.multipart;

        const mpg = spawn('mpg123', ['-']);

        mpg.on('error', (err) => {
          console.log(err);
        });

        mpg.on('message', (msg) => {
          console.log(msg);
        });

        if (Array.isArray(multipart)) {

          multipart.forEach(function(part) {
            var headers = part.headers;
            var bodyBuffer = part.body;

            var audio = "";

            if(self.hasValue(headers, 'Content-Type', 'application/octet-stream')){
              mpg.stdin.end(bodyBuffer);
            }
          });
        }

      });

    });

    self.audioReq.on('push', (pushRequest) => {
      console.log('Receiving pushed resource');
    }); 

    self.audioReq.on('error', (err) => {
      console.log(err);
      elf.emit('error', err);
    });


    var payload = {
        "context": [
        ],
        "event": {
            "header": {
                "namespace": "SpeechRecognizer",
                "name": "Recognize",
                "messageId": "messageId-123",
                "dialogRequestId": "dialogRequestId-321"
            },
            "payload": {
                "profile": "CLOSE_TALK",
                "format": "AUDIO_L16_RATE_16000_CHANNELS_1"
            }
        }
    };

    var postSyncDataStart = [
        NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, METADATA_CONTENT_DISPOSITION, NEWLINE, METADATA_CONTENT_TYPE,
        NEWLINE, NEWLINE, JSON.stringify(payload, null, 2), NEWLINE, NEWLINE, BOUNDARY_DASHES, BOUNDARY, NEWLINE, 
        AUDIO_CONTENT_DISPOSITION, NEWLINE, AUDIO_CONTENT_TYPE, NEWLINE, NEWLINE
      ].join('');


    console.log(`sending start ${postSyncDataStart}`);
    self.audioReq.write(postSyncDataStart);

    var recording = record.start({
      threshold: 5
    });

    recording.on('finish', () => {

      var postSyncDataAudioEnd = [
          NEWLINE, BOUNDARY_DASHES, BOUNDARY, BOUNDARY_DASHES
        ].join('');

      console.log(`sending end ${postSyncDataAudioEnd}`);
      self.audioReq.write(postSyncDataAudioEnd);

      console.log(`closing connection`);
      self.audioReq.end();

      self.emit('done');

    });

    recording.pipe(self.audioReq);

  }

}

const EventEmitter = require('events').EventEmitter;
util.inherits(Alexa, EventEmitter);
module.exports = new Alexa;