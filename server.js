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

var Bootstraper = require('bootstraper');
new Bootstraper(upstream_host, upstream_port);

// TwitterClient.add_client(123);

