const http = require('http');
const Socket = require('./socks5/socket');
const net = require('net');

var option = {
    socksPort: 1337,
    socksHost: '127.0.0.1',
    method: 'GET',
    host: 'www.baidu.com',
    port: 80,
    createConnection: (options, callback) => {
        return new Socket(options).connect(options, callback);
    }
};

let req = http.request(option, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');
    });
});

req.on('error', (e) => {
    console.error(e);
});

req.end();
