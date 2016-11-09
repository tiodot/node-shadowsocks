const http = require('http');
const Socket = require('./socks5/socket');
const net = require('net');
const url = require('url');

const CAPITALIZE = /(\w)\w+-?/g;

let defautOption = {
    socksPort: 1080,
    socksHost: '127.0.0.1',
    method: 'GET',
    createConnection: (options, callback) => {
        return new Socket(options).connect(options, callback);
    }
};

function capitalizeFirstLetter (str) {
    if (!str) {
        return str;
    }
    return str.replace(CAPITALIZE, ($0, $1) => ($1.toUpperCase() + $0.slice(1)));
}

function proxyRequest (option, res, data) {
    console.log(option);
    let proxy = http.request(option, (response) => {
        console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
        //res.writeHead(200, response.headers);
        for (let key in response.headers) {
            if (response.headers.hasOwnProperty(key)) {
                res.setHeader(capitalizeFirstLetter(key), response.headers[key]);
            }
        }
        res.writeHead(response.statusCode);
        //res.setHeader(response.headers);
        response.on('data', (chunk) => {
            res.write(chunk);
        });
        response.on('end', () => {
            res.end();
        });
    });

    proxy.on('error', (e) => {
        console.error(e);
    });
    console.log(data && data.toString());
    data && proxy.write(data);
    proxy.end();
}

http.createServer((req, res) => {
    console.log(req.url);
    let urlObj = url.parse(req.url);
    let headers = req.headers;
    let option = Object.assign({}, defautOption, {
        host: req.headers.host,
        method: req.method,
        port: 80,
        path: urlObj.path,
        headers: {}
    });
    for (let header in headers) {
        if (headers.hasOwnProperty(header)) {
            option.headers[capitalizeFirstLetter(header)] = headers[header];
        }
    }
    console.log('method: ' + req.method);
    console.log(req.headers);
    if (req.method.toLocaleLowerCase() === 'post') {
        let body = '';
        req.on('data', (data) => {
            body += data;
        });
        req.on('end', () => {
            proxyRequest(option, res, body);
        })
    }
    else {
        proxyRequest(option, res);
    }
}).listen(1338, () => {
    console.log('local server at 1338');
});

/*
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
*/