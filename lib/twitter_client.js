var http = require('http'),
    sys  = require('sys'),
    url  = require('url'),
    OAuth = require('oauth').OAuth,
    Parser = require('parser');

function TwitterClient(twitter_ids) {
  if(!(this instanceof arguments.callee)) {
    return new arguments.callee(arguments);
  }

  var self = this;
  
  self.backof_ms           = 500;
  self.twitter_ids         = twitter_ids;

  self.parser = new Parser();
  self.parser.addListener('object', function(data) {
    self.processNewData(data);
  });
  self.parser.addListener('error', function (error) {
    console.log('Error parsing twitter: ' + error.message);
  });
  
  self.init();
};

TwitterClient.initiateConnections = function(twitter_ids) {
  if(typeof TwitterClient.clients == 'undefined') {
    TwitterClient.clients = [];
  }
  
  // get all running tweet ids
  if(twitter_ids == null) {
    twitter_ids = [];
    TwitterClient.clients.forEach(function(element, index, array) {
      twitter_ids = twitter_ids.concat(element.twitter_ids);
    });
  }
  
  console.log(">>> Processing clients " + twitter_ids.length);
  
  // close all existing connections
  TwitterClient.clients.forEach(function(element, index, array) {
    element.close();
  });
  
  console.log(">>> Closed all existing connections");
  
  // initialize new connections
  var i = 0;
  TwitterClient.clients = [];
  while((group = twitter_ids.slice(i * 100, i * 100 + 99)).length > 0) {
    TwitterClient.clients.push(new TwitterClient(group));
    i++;
  }
  
  // set up next compactation
  setTimeout(TwitterClient.compact, 1000 * 3600 * 24);
};

TwitterClient.compact = function() {
  console.log("!!! Compacting streams...");
  TwitterClient.initiateConnections(null);
}

TwitterClient.add_client = function(twitter_id) {
  TwitterClient.clients.push(new TwitterClient([twitter_id]));
}

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

  param_ids = self.twitter_ids.join(',');
  self.request = self.oauth.get(global.config.twitter_user_stream + "?with=followings&follow=" + param_ids, global.config.owner_oauth_token, global.config.owner_oauth_token_secret);

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
      
      response.setEncoding('utf8');
      response.on('data', function(chunk) { console.log(chunk); });
      
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

TwitterClient.prototype.close = function() {
  var self = this;
  
  self.request.socket.destroy();
  
  self.request = null;
  self.parser  = null;
  self.oauth   = null;
  
  console.log(">>> Closed connection");
}

TwitterClient.prototype.processNewData = function(data) {
  var self = this;

  // snowflake yeah :D
  if(data.message.id && data.message.id_str) {
    data.message.id = data.message.id_str;
  }
  
  var data_string = JSON.stringify(data.message);
  console.log(">>> " + JSON.stringify(data));
  
  var data_size = Buffer.byteLength(data_string, 'utf8');

  var upstream = http.createClient(global.config.upstream_port, global.config.upstream_host);
  var request = upstream.request('POST', global.config.upstream_path + "/" + data.for_user, { 'host':global.config.upstream_host, 'Content-Length':data_size });
  
  request.on('response', function(response) {
    response.setEncoding('utf8');
    console.log("@@@ " + response.statusCode);
  });
  
  request.end(data_string);
};

module.exports = TwitterClient;
