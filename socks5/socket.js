const net = require('net');

function parseIPv4(host, request) {
    var i, ip, groups = host.split('.');

    for (i = 0; i < 4; i++) {
        ip = parseInt(groups[i], 10);
        request.push(ip);
    }
}

function parseString(string, request) {
    var buffer = Buffer.from(string), i, l = buffer.length;
    request.push(l);
    for (i = 0; i < l; i++) {
        request.push(buffer[i]);
    }
}

class Socket extends net.Socket {
    constructor (options) {
        super();
        this.options = options;
        this.socksHost = options.socksHost || 'localhost';
        this.socksPort = options.socksPort || 1080;
    }
    connect (options, callback) {
        let that = this;
        super.connect(this.socksPort, this.socksHost, () => {
            that.authenticateWithSocks(() => {
                that.connectSocksToHost(() => {
                    callback && typeof callback === 'function' && callback(null, that);
                })
            });
        });

    }
    authenticateWithSocks (callback) {
        this.once('data', function(data) {
            console.log(data.toJSON());
            var error;

            if (data.length !== 2) {
                error = new Error('SOCKS authentication failed. Unexpected number of bytes received.');
            } else if (data[0] !== 0x05) {
                error = new Error('SOCKS authentication failed. Unexpected SOCKS version number: ' + data[0] + '.');
            } else if (data[1] !== 0x00) {
                error = new Error('SOCKS authentication failed. Unexpected SOCKS authentication method: ' + data[1] + '.');
            }

            if (error) {
                console.error(error);
                return;
            }

            if (callback) {
                callback();
            }
        });

        // Add the "no authentication" method.
        /**
         +----+----------+----------+
         |VER | NMETHODS | METHODS  |
         +----+----------+----------+
         | 1  |    1     | 1 to 255 |
         +----+----------+----------+
         */
        let bufferToSend = [0x05, 1, 0x00];
        this.write(Buffer.from(bufferToSend));
    }
    connectSocksToHost (callback) {
        let that = this;
        this.once('data', function(data) {
            console.log(data.toJSON());
            var i, address, addressLength, error;

            if (data[0] !== 0x05) {
                error = new Error('SOCKS connection failed. Unexpected SOCKS version number: ' + data[0] + '.');
            } else if (data[1] !== 0x00) {
                error = new Error('SOCKS connection failed. ' + data[1] + '.');
            } else if (data[2] !== 0x00) {
                error = new Error('SOCKS connection failed. The reserved byte must be 0x00.');
            }

            if (error) {
                console.error(error);
                return;
            }

            address = '';
            addressLength = 0;

            switch (data[3]) {
                case 1:
                    address = data[4] + '.' + data[5] + '.' + data[6] + '.' + data[7];
                    addressLength = 4;
                    break;
                case 3:
                    addressLength = data[4] + 1;
                    for (i = 5; i < addressLength; i++) {
                        address += String.fromCharCode(data[i]);
                    }
                    break;
                case 4:
                    addressLength = 16;
                    break;
                default:
                    console.log('SOCKS connection failed. Unknown addres type: ' + data[3] + '.');
                    return;
            }

            if (callback) {
                callback();
            }
        });
        let request = [];
        let host = this.options.host;
        let port = this.options.port;
        let portLen = port.length || 2;
        request.push(0x05); // SOCKS version.
        request.push(0x01); // Command code: establish a TCP/IP stream connection.
        request.push(0x00); // Reserved - must be 0x00.
        switch (net.isIP(host)) {
            // Add a hostname to the request.
            case 0:
                request.push(0x03);
                parseString(host, request);
                break;

            // Add an IPv4 address to the request.
            case 4:
                request.push(0x01);
                parseIPv4(host, request);
                break;
        }
        request.length += portLen;
        let buffer = Buffer.from(request);
        buffer.writeUInt16BE(port, buffer.length - portLen, true);
        this.write(buffer);
    }
}

module.exports = Socket;