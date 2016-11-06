
const net = require("net");
const path = require("path");
const utils = require('./utils');
const Encryptor = require("./encrypt").TinyEncryptor;

let connections = 0;

module.exports = createLocalServer;

function createLocalServer (serverAddr, serverPort, port, key, method, timeout, local_address) {
    let server = net.createServer((connection) => {
        let connected = true,
            encryptor = new Encryptor(key, method),
            stage = 0,
            headerLength = 0,
            remote = null,
            addrLen = 0,
            remoteAddr = null,
            remotePort = null,
            addrToSend = "";

        connections += 1;

        let clean = () => {
            utils.debug("clean");
            connections -= 1;
            remote = null;
            connection = null;
            encryptor = null;
            return utils.debug("connections: " + connections);
        };

        utils.debug(`connections: ${connections}`);

        connection.on("data", (data) => {

            if (stage === 5) {
                data = encryptor.encrypt(data);
                if (!remote.write(data)) {
                    connection.pause();
                }
                return utils.debug('stage = 5');
            }
            if (stage === 0) {
                let tempBuf = Buffer.allocUnsafe(2);
                tempBuf.write("\u0005\u0000", 0, 2, 'binary');
                connection.write(tempBuf);
                stage = 1;
                return utils.debug('stage = 1');
            }
            if (stage === 1) {
                try {
                    let cmd = data[1];
                    let addrtype = data[3];
                    let reply;
                    utils.debug(`CMD: ${cmd} && addr type: ${addrtype}`);
                    if (cmd === 1) {
                        utils.debug('Connect，连接其他服务器');
                    }
                    else {
                        utils.error(`unsupported cmd: ${cmd}`);
                        reply = new Buffer("\u0005\u0007\u0000\u0001", "binary");
                        connection.end(reply);
                        return;
                    }
                    if (addrtype === 3) {
                        addrLen = data[4];
                    } else if (addrtype !== 1 && addrtype !== 4) {
                        utils.error(`unsupported addrtype: ${addrtype}`);
                        connection.destroy();
                        return;
                    }
                    addrToSend = data.slice(3, 4).toString("binary");
                    if (addrtype === 1) {
                        remoteAddr = utils.inetNtoa(data.slice(4, 8));
                        addrToSend += data.slice(4, 10).toString("binary");
                        remotePort = data.readUInt16BE(8);
                        headerLength = 10;
                    }
                    else if (addrtype === 4) {
                        remoteAddr = utils.inetNtop(data.slice(4, 20));
                        addrToSend += data.slice(4, 22).toString("binary");
                        remotePort = data.readUInt16BE(20);
                        headerLength = 22;
                    }
                    else {
                        remoteAddr = data.slice(5, 5 + addrLen).toString("binary");
                        addrToSend += data.slice(4, 5 + addrLen + 2).toString("binary");
                        remotePort = data.readUInt16BE(5 + addrLen);
                        headerLength = 5 + addrLen + 2;
                    }

                    let buf = new Buffer(10);
                    buf.write("\u0005\u0000\u0000\u0001", 0, 4, "binary");
                    buf.write("\u0000\u0000\u0000\u0000", 4, 4, "binary");
                    buf.writeInt16BE(2222, 8);
                    connection.write(buf);

                    utils.debug("connecting " + serverAddr + ":" + serverPort);

                    remote = net.connect(serverPort, serverAddr, () => {
                        utils.debug('connected remote server');
                        if (remote) {
                            remote.setNoDelay(true);
                        }
                        stage = 5;
                    });
                    remote.on("data", (data) => {
                        if (!connected) {
                            return;
                        }
                        utils.debug("received data from remote ");
                        try {
                            if (encryptor) {
                                data = encryptor.decrypt(data);
                                if (!connection.write(data)) {
                                    return remote.pause();
                                }
                            } else {
                                return remote.destroy();
                            }
                        } catch (err) {
                            utils.error(err);
                            if (remote) {
                                remote.destroy();
                            }
                            if (connection) {
                                return connection.destroy();
                            }
                        }
                    });
                    remote.on("end", () => {
                        utils.debug("remote end");
                        if (connection) {
                            return connection.end();
                        }
                    });
                    remote.on("error", (e) => {
                        return console.error("remote " + remoteAddr + ":" + remotePort + " error: " + e);
                    });
                    remote.on("close", (had_error) => {
                        utils.debug("remote on close: " + had_error);
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
                        utils.debug("remote on timeout");
                        if (remote) {
                            remote.destroy();
                        }
                        if (connection) {
                            return connection.destroy();
                        }
                    });

                    let addrToSendBuf = new Buffer(addrToSend, "binary");
                    addrToSendBuf = encryptor.encrypt(addrToSendBuf);
                    remote.setNoDelay(false);
                    remote.write(addrToSendBuf);

                    if (data.length > headerLength) {
                        buf = new Buffer(data.length - headerLength);
                        data.copy(buf, 0, headerLength);
                        let piece = encryptor.encrypt(buf);
                        remote.write(piece);
                    }
                    stage = 4;

                }
                catch (err) {
                    utils.error(err);
                    if (connection) {
                        connection.destroy();
                    }
                    if (remote) {
                        remote.destroy();
                    }
                }
            }
            else if (stage === 4) {
                if (remote == null) {
                    if (connection) {
                        connection.destroy();
                    }
                    return;
                }
                data = encryptor.encrypt(data);
                remote.setNoDelay(true);
                if (!remote.write(data)) {
                    return connection.pause();
                }
            }
        });
        connection.on("end", () => {
            connected = false;
            utils.debug("connection on end");
            if (remote) {
                return remote.end();
            }
        });
        connection.on("error", (e) => {
            return utils.error(e);
        });
        connection.on("close", (had_error) => {
            connected = false;
            utils.debug(`connection on close: ${had_error}`);
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
            if (remote && stage === 5) {
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



    server.listen(port, local_address, () => {
        return utils.info("local listening at " + (server.address().address) + ":" + port);
    });

    server.on('error', (e) => {
        if (e.code === "EADDRINUSE") {
            return utils.error("Address in use, aborting");
        } else {
            return utils.error(e);
        }
    });
    return server;
}



if (!module.parent) {
    const config = require('../config.json');
    let server = createLocalServer(
        config.server,
        config.server_port,
        config.local_port,
        config.password,
        config.method,
        config.timeout * 1000,
        config.local_address
    );
    server.on("error", () => {
        utils.info('stop server');
        return process.stdout.on('drain', () => {
            return process.exit(1);
        });
    });
}