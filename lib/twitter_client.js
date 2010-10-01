var http = require('http'),
    sys  = require('sys'),
    url  = require('url'),
    OAuth = require('../vendor').oauth.OAuth,
    Parser = require('parser');

function TwitterClient(access_token, access_token_secret, twitter_id) {
  if(!(this instanceof arguments.callee)) {
    return new arguments.callee(arguments);
  }

  var self = this;
  
  self.backof_ms           = 500;
  self.access_token        = access_token;
  self.access_token_secret = access_token_secret;
  self.twitter_id          = twitter_id;

  self.parser = new Parser();
  self.parser.addListener('object', function(data) {
    self.processNewData(data);
  });
  self.parser.addListener('error', function (error) {
    console.log('Error parsing twitter: ' + error.message);
  });
  
  self.init();
};

TwitterClient.prototype.init = function() {
  var self = this;

  self.oauth = new OAuth('https://twitter.com/oauth/request_token',
                         'https://twitter.com/oauth/access_token',
                         global.config.twitter_consumer_token, global.config.twitter_consumer_secret,
                         "2.0", 'http://localhost:3000/oauth/callback', 'HMAC-SHA1');

  self.createTwitterConnection();
};

TwitterClient.prototype.createTwitterConnection = function() {
  var self = this;
  self.backof_ms *= 2;

  self.request = self.oauth.get(global.config.twitter_user_stream, self.access_token, self.access_token_secret);

  self.request.on('response', function(response) {
    if(response.statusCode == 200) {
      self.backof_ms = 500;

      response.setEncoding('utf8');
      response.on('data', function(chunk) {
        // twitter sends empty lines to keep the channel open
        if(chunk != "\r\n") {
          self.parser.receive(chunk);
        }
      });
      response.on('end', function() {
        console.log("Twitter connection closed... retrying");
        self.createTwitterConnection();
      });
    } else {
      console.log("ERROR CONNECTING TWITTER CLIENT " + response.statusCode);
      console.log("retrying in " + self.backof_ms);
      setTimeout(function() {
        self.createTwitterConnection();
      }, self.backof_ms);
    }
  });

  self.request.socket.on('error', function(error) {
    console.log(error.message);
    console.log("retrying in " + self.backof_ms);
 
    setTimeout(function() {
      self.createTwitterConnection();
    }, self.backof_ms);
  });

  self.request.end();
};

TwitterClient.prototype.processNewData = function(data) {
  var self = this;
  
  var data_string = JSON.stringify(data);
  console.log(">>> " + data_string);
  
  var data_size = Buffer.byteLength(data_string, 'utf8');

  var upstream = http.createClient(global.config.upstream_port, global.config.upstream_host);
  var request = upstream.request('POST', global.config.upstream_path + "/" + self.twitter_id, { 'host':global.config.upstream_host, 'Content-Length':data_size });
  
  request.on('response', function(response) {
    response.setEncoding('utf8');
    console.log("@@@ " + response.statusCode);
    
    upstream.close();
  });
  
  request.end(data_string);
};

module.exports = TwitterClient;

