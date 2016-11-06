const net = require('net');
const path = require('path');
const utils = require('./utils');
const Encryptor = require('./encrypt').TinyEncryptor;

let connections = 0;

const config = require('../config.json');

const timeout = Math.floor(config.timeout * 1000) || 300000;

let inetNtoa = (buf) => {
    return buf[0] + "." + buf[1] + "." + buf[2] + "." + buf[3];
};

let server = net.createServer((connection) => {
    let encryptor = new Encryptor(config.password, config.method),
        stage = 0,
        headerLength = 0,
        remote = null,
        cachedPieces = [],
        addrLen = 0,
        remoteAddr = null,
        remotePort = null;

    let clean = () => {
        utils.debug("clean");
        connections -= 1;
        remote = null;
        connection = null;
        encryptor = null;
        return utils.debug("connections: " + connections);
    };

    connections += 1;

    connection.on('data', (data) => {
        utils.debug('connection on data');
        try {
            data = encryptor.decrypt(data);
        }
        catch (err) {
            utils.error(err);
            if (remote) {
                remote.destroy();
            }
            if (connection) {
                connection.destroy();
            }
            return;
        }
        if (stage === 5) {
            if (!remote.write(data)) {
                connection.pause();
            }
            return utils.debug('stage == 5');
        }
        if (stage === 0) {
            try {
                let addrtype = data[0];
                utils.debug('stage == 0 && addr type: ' + addrtype);
                if (addrtype === void 0) {
                    return;
                }
                if (addrtype === 3) {
                    addrLen = data[1];
                } else if (addrtype !== 1 && addrtype !== 4) {
                    utils.error("unsupported addrtype: " + addrtype + " maybe wrong password");
                    connection.destroy();
                    return;
                }
                if (addrtype === 1) {
                    remoteAddr = inetNtoa(data.slice(1, 5));
                    remotePort = data.readUInt16BE(5);
                    headerLength = 7;
                } else if (addrtype === 4) {
                    remoteAddr = utils.inetNtop(data.slice(1, 17));
                    remotePort = data.readUInt16BE(17);
                    headerLength = 19;
                } else {
                    remoteAddr = data.slice(2, 2 + addrLen).toString("binary");
                    remotePort = data.readUInt16BE(2 + addrLen);
                    headerLength = 2 + addrLen + 2;
                }
                utils.debug("ready to pause connection " );
                connection.pause();
                utils.debug('paused and ready to connect ' + remoteAddr + ":" + remotePort);

                remote = net.connect(remotePort, remoteAddr, () => {
                    var i, piece;
                    utils.debug("connecting " + remoteAddr + ":" + remotePort);
                    if (!encryptor || !remote || !connection) {
                        utils.debug('no connection or remote or encryptor');
                        if (remote) {
                            remote.destroy();
                        }
                        return;
                    }
                    i = 0;
                    connection.resume();
                    while (i < cachedPieces.length) {
                        piece = cachedPieces[i];
                        remote.write(piece);
                        i++;
                    }
                    cachedPieces = null;
                    remote.setTimeout(timeout, () => {
                        utils.debug("remote on timeout during connect()");
                        if (remote) {
                            remote.destroy();
                        }
                        if (connection) {
                            return connection.destroy();
                        }
                    });
                    stage = 5;
                });
                remote.on("data", (data) => {
                    utils.debug('remote on data...');
                    if (!encryptor) {
                        if (remote) {
                            remote.destroy();
                        }
                        return;
                    }
                    data = encryptor.encrypt(data);
                    if (!connection.write(data)) {
                        return remote.pause();
                    }
                });
                remote.on("end", () => {
                    utils.debug("remote on end");
                    if (connection) {
                        return connection.end();
                    }
                });
                remote.on("error", (e) => {
                    return utils.error("remote " + remoteAddr + ":" + remotePort + " error: " + e);
                });
                remote.on("close", (had_error) => {
                    utils.debug("remote on close:" + had_error);
                    if (had_error) {
                        if (connection) {
                            return connection.destroy();
                        }
                    } else {
                        if (connection) {
                            return connection.end();
                        }
                    }
                });
                remote.on("drain", () => {
                    utils.debug("remote on drain");
                    if (connection) {
                        return connection.resume();
                    }
                });
                remote.setTimeout(timeout, () => {
                    utils.debug("remote on timeout during connect()");
                    if (remote) {
                        remote.destroy();
                    }
                    if (connection) {
                        return connection.destroy();
                    }
                });
                let buf;
                if (data.length > headerLength) {
                    buf = new Buffer(data.length - headerLength);
                    data.copy(buf, 0, headerLength);
                    cachedPieces.push(buf);
                    buf = null;
                }
                stage = 4;
                return utils.debug('stage === 4');
            } catch (err) {
                console.error(err);
                connection.destroy();
                if (remote) {
                    return remote.destroy();
                }
            }
        }
        else {
            if (stage === 4) {
                return cachedPieces.push(data);
            }
        }
    });

    connection.on("end", () => {
        utils.debug("connection on end");
        if (remote) {
            return remote.end();
        }
    });
    connection.on("error", (e) => {
        return utils.error("local error: " + e);
    });
    connection.on("close", (had_error) => {
        utils.debug("connection on close:" + had_error);
        if (had_error) {
            if (remote) {
                remote.destroy();
            }
        } else {
            if (remote) {
                remote.end();
            }
        }
        return clean();
    });
    connection.on("drain", () => {
        utils.debug("connection on drain");
        if (remote) {
            return remote.resume();
        }
    });
    return connection.setTimeout(timeout, () => {
        utils.debug("connection on timeout");
        if (remote) {
            remote.destroy();
        }
        if (connection) {
            return connection.destroy();
        }
    });
});

server.listen(config.server_port, config.server, () => {
    return utils.info("server listening at " + config.server + ":" + config.server_port + " ");
});

server.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
        utils.error("Address in use, aborting");
    } else {
        utils.error(e);
    }
    return process.stdout.on('drain', () => {
        return process.exit(1);
    });
});