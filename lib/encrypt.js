const crypto = require('crypto');
const util = require("util");

const utils = require('./utils');

const bytesToKeyCache = {};

let bytesToKey = (password, keyLen, ivLen) => {
    let key = [password, keyLen, ivLen].join('-');
    if (bytesToKeyCache[key]) {
        return bytesToKeyCache[key];
    }
    let results = [], i = 0, count = 0, totalLen = keyLen + ivLen;
    while (count < totalLen) {
        let md5 = crypto.createHash('md5');
        if (i) {
            md5.update(Buffer.concat([results[i-1], password]));
        }
        else {
            md5.update(password);
        }
        let result = md5.digest();
        results.push(result);
        count += result.length;
        i += 1;
    }
    let resultsBuf = Buffer.concat(results);
    let cache = [resultsBuf.slice(0, keyLen), resultsBuf.slice(keyLen, totalLen)];
    bytesToKeyCache[key] = cache;
    return cache;
};

/**
 * sslocal 和 ssserver加密，先支持一种 "aes-256-cfb"
 * 其他可以参考： https://github.com/shadowsocks/shadowsocks-nodejs/blob/master/lib/shadowsocks/encrypt.js
 */
class TinyEncryptor {
    constructor (key, method) {
        this.key = key;
        this.method = method.toLowerCase();
        this.model = [32, 16];
        this.ivSent = false;
        this.cipher = this.getCipher(1, crypto.randomBytes(32));
        utils.debug(`【TinyEncryptor】create encrypt ${key} : ${method}`);
    }

    getCipher (operation, iv) {
        const password = Buffer.from(this.key, 'binary');
        const method = this.method;
        const model = this.model;
        const key = bytesToKey(password, model[0], model[1]);
        iv = iv.slice(0, model[1]);
        if (operation === 1) {
            this.cipherIv = iv;
            return crypto.createCipheriv(method, key[0], iv);
        }
        else {
            return crypto.createDecipheriv(method, key[0], iv);
        }
    }

    encrypt (buf) {
        let result = this.cipher.update(buf);
        if (this.ivSent) {
            return result;
        }
        else {
            this.ivSent = true;
            return Buffer.concat([this.cipherIv, result]);
        }
    }

    decrypt (buf) {
        if (this.decipher == null) {
            let ivLen = this.model[1];
            //let iv = buf.slice(0, ivLen);
            this.decipher = this.getCipher(0, buf);
            return this.decipher.update(buf.slice(ivLen));
        }
        else {
            return this.decipher.update(buf);
        }
    }
}

exports.TinyEncryptor = TinyEncryptor;
exports.encryptAll = (password, method, op, data) => {
    let result = [];
    method = method.toLowerCase();
    let keyLen = 32, ivLen = 16, iv, cipher;
    const key = bytesToKey(password, keyLen, ivLen);
    if (op === 1) {
        iv = crypto.randomBytes(ivLen);
        result.push(iv);
        cipher = crypto.createCipheriv(method, key[0], iv);
    }
    else {
        iv = data.slice(0, ivLen);
        data = data.slice(ivLen);
        cipher = crypto.createDecipheriv(method, key[0], iv);
    }
    result.push(cipher.update(data));
    result.push(cipher.final());

    utils.debug('encrypt all: ' + data.toString());

    return Buffer.concat(result);
};