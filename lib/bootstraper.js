var http = require('http'),
    sys = require('sys'),
    url = require('url'),
    express = require('../vendor').express,
    TwitterClient = require('twitter_client');

function Bootstraper(upstream_host, upstream_port) {
  if(!(this instanceof arguments.callee)) {
    return new arguments.callee(arguments);
  }

  var self = this;
  self.upstream_host = upstream_host;
  self.upstream_port = parseInt(upstream_port);
  
  self.init();
};

Bootstraper.prototype.init = function() {
  var self = this;

  var server = http.createClient(self.upstream_port, self.upstream_host);
  var request = server.request('GET', '/nodejs/bootstrap', {'host':self.upstream_host});
  request.on('response', function(response) {
    response.setEncoding('utf8');

    var data = "";
    response.on('data', function(chunk) {
      data += chunk;
    });

    response.on('end', function() {
      var json_data = JSON.parse(data);
      console.log("got config: " + data);
      
      global.config = json_data.config;

      twitter_ids = [];
      for(var i=0; i<json_data.clients.length; i++) {
        twitter_ids.push(json_data.clients[i].twitter_id);
      }
      
      TwitterClient.initiateConnections(twitter_ids);

      self.startServer();
      console.log('boostrapped!');
    });
    
  });

  server.on('error', function(e) {
    console.log('BOOSTRAP FAILED, boostrap server down?');
    console.log(e.message);
    process.exit(2);
  });

  request.end();
};

Bootstraper.prototype.startServer = function() {
  var self = this;
  
  self.server = express.createServer(
    express.logger(),
    express.bodyDecoder()
  );
  
  self.server.post('/add_client', function(req, res) {
    var id = req.param('id');
    var twitter_id = req.param('twitter_id');
    
    if(id && twitter_id) {
      TwitterClient.add_client(twitter_id);
    
      res.send(200);
    } else {
      res.send(400);
    }
  });
  
  self.server.listen(6666);
  console.log('local http server started');
};

module.exports = Bootstraper;

