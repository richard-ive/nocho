const psc = require('pocketsphinx-continuous');
const util = require('util');

function Listen(){
	var ps;

	var self = this;

	this.start = function(keyword){

		console.log('Starting to listen');

		ps = new psc({
		  setId: '5604',  // A "set id". See explanation below.
		  verbose: true // Setting this to true will give you a whole lot of debug output in your console.
		});

		ps.on('data', (data) => {
		  console.log('Data :' + data);
		  if(data === keyword){
		  	self.emit('spoken-to', self);
		  }
		});

		ps.on('error', (err) => {
		  console.log('Err :' + err);
		});

	};

	this.end = function(){
		ps.removeAllListeners();
		ps = null;
	}

}

const EventEmitter = require('events').EventEmitter;
util.inherits(Listen, EventEmitter);

module.exports = new Listen;