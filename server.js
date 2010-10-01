require(__dirname + "/vendor");
require.paths.unshift(__dirname + "/lib");

if(process.argv.length != 4) {
  console.log('Please use node server.js bootstrap_host bootstrap_port');
  process.exit(1);
}

var upstream_host = process.argv[2];
var upstream_port = process.argv[3];

process.addListener('uncaughtException', function(err, stack) {
  console.log('--------------------------------');
  console.log('Exception: ' + err);
  console.log(err.stack);
  console.log('--------------------------------');
});

var chainGang = require('chain-gang');
var TwitterClient = require('twitter_client');

global.config = {}
global.clientQueue = chainGang.create({workers:1});
global.clientCallback = function(worker) {
  console.log(worker.performing);
  
  var data = JSON.parse(worker.performing);

  new TwitterClient(data.oauth_token, data.oauth_token_secret, data.twitter_id);

  setTimeout(function() {
    console.log('finished client worker');
    worker.finish();
  }, 1000);
};
global.clientQueue.addListener('error', function(name, error) {
  console.log(error);
  console.log(name);
});

var Bootstraper = require('bootstraper');
new Bootstraper(upstream_host, upstream_port);

// new TwitterClient("oauth token", 123);

