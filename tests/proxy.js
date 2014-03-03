/*
This is an example proxy that helps tests fxa-js-client requests in IE8 and IE9
 */
var httpProxy = require('http-proxy');
var fs = require('fs');
var path = require('path');

var proxy = httpProxy.createProxyServer({});

var server = require('http').createServer(function(req, res) {
  if (req.url === '/example.html') {
    res.end(fs.readFileSync(path.join('tests', 'example.html')));
  }
  else if (req.url === '/build/fxa-client.js') {
    res.end(fs.readFileSync(path.join('build', 'fxa-client.js')));
  } else {
    proxy.web(req, res, { target: 'http://192.168.2.193:9000' });
  }
});

console.log("Proxy listening on port 5050");
server.listen(5050);
