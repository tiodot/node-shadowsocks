const util = require('util');

const color = {
    //colors
    'blue': (msg) => {
        return `\x1B[34m ${msg} \x1B[39m`
    },
    'cyan': (msg) => {
        return `\x1B[36m ${msg} \x1B[39m`
    },
    'green': (msg) => {
        return `\x1B[32m ${msg} \x1B[39m`
    },
    'magenta': (msg) => {
        return `\x1B[35m ${msg} \x1B[39m`
    },
    'red': (msg) => {
        return `\x1B[31m ${msg} \x1B[39m`
    },
    'grey': (msg) => {
        return `\x1B[90m ${msg} \x1B[39m`
    },
    'yellow': (msg) => {
        return `\x1B[33m ${msg} \x1B[39m`
    }
};
/**
 * [级别] 全部输出
 * @name L_ALL
 */
exports.L_ALL = 0x01111;

/**
 * [级别] 输出 notice 信息
 * @name L_NOTICE
 */
exports.L_NOTICE = 0x00001;

/**
 * [级别] 输出 debug 信息
 * @name L_DEBUG
 */
exports.L_DEBUG = 0x00010;

/**
 * [级别] 输出 warning 信息
 * @name L_WARNI
 */
exports.L_WARNING = 0x00100;

/**
 * [级别] 输出 error 信息
 * @name L_ERROR
 */
exports.L_ERROR = 0x01000;

/**
 * [级别] 输出标准信息，包含: error, warning 和 notice 信息。
 * 等价于：`log.L_ERROR | log.L_WARNING | log.L_NOTICE`
 * @name L_NORMAL
 */
exports.L_NORMAL = 0x01101;

/**
 * [级别] 配置项，默认是 `L_NORMAL`。 可以外部配置成其他级别。
 */
exports.level = exports.L_ALL;


/**
 * 获取当前时间
 * @param  {Boolean} withoutMilliseconds 是否不显示豪秒
 * @return {String}                     HH:MM:SS.ms
 * @name now
 * @function
 */
exports.now = function (withoutMilliseconds) {
    var d = new Date(),
        str;
    str = [
        d.getHours(),
        d.getMinutes(),
        d.getSeconds()
    ].join(':').replace(/\b\d\b/g, '0$&');
    if (!withoutMilliseconds) {
        str += '.' + ('00' + d.getMilliseconds()).substr(-3);
    }
    return str;
};

exports.on = {
    debug: function (msg) {
        process.stdout.write(`${color['grey']('[DEBUG]')}  ${msg} \n`);
    },
    notice: function (msg) {
        process.stdout.write(`${color['cyan']('[INFO]  ' + msg)} \n`);
    },
    warning: function (msg) {
        process.stdout.write(`${color['yellow']('[WARNING] ' + msg)} \n`);
    },
    error: function (msg) {
        process.stdout.write(`${color['red']('[ERROR] ' + msg)} \n`);
    }
};

function log(type, msg, code) {
    code = code || 0;
    if ((exports.level & code) > 0) {
        var listener = exports.on[type];
        if (listener) {
            listener(msg);
        }
    }
}

exports.debug = function (msg) {
    msg = util.format.apply(util, arguments);
    log('debug', exports.now() + ' ' + msg, exports.L_DEBUG);
};

exports.notice = exports.info = function (msg) {
    msg = util.format.apply(util, arguments);
    log('notice', msg, exports.L_NOTICE);
};


exports.warning = exports.warn = function (msg) {
    msg = util.format.apply(util, arguments);
    log('warning', msg, exports.L_WARNING);
};


exports.table = function (obj) {
    console.dir(obj, {colors: true});
};

exports.error = function (err) {

    if (!(err instanceof Error)) {
        err = new Error(err.message);
    }

    log('error', err.message, exports.L_ERROR);
    exports.debug(err.stack);
    process.exit(1);
};

// log end


/**功能级别*/
exports.inetNtoa = function (buf) {
    return buf[0] + "." + buf[1] + "." + buf[2] + "." + buf[3];
};

exports.inetAton = function (ipStr) {
    var buf, i, parts;
    parts = ipStr.split(".");
    if (parts.length !== 4) {
        return null;
    } else {
        buf = new Buffer(4);
        i = 0;
        while (i < 4) {
            buf[i] = +parts[i];
            i++;
        }
        return buf;
    }
};

exports.getKey = function () {
    return arguments.join(':');
};

exports.inetPton = (ip) => {
    let regex = /^(?:\d{1,3}(?:\.|$)){4}/;
    let f = String.fromCharCode;

    let m = ip.match(regex); // IPv4

    if (m) {
        m = m[0].split('.');
        m = f(m[0]) + f(m[1]) + f(m[2]) + f(m[3]);
        // Return if 4 bytes, otherwise false.
        return m.length === 4 ? m : false;
    }
    return false;
};

exports.inetNtop = (a) => {

    if (a.length === 4) { // IPv4
        a += '';
        return [a.charCodeAt(0), a.charCodeAt(1), a.charCodeAt(2), a.charCodeAt(3)].join('.');
    }
    return false;
};