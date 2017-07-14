"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var logging_1 = require("./lib/logging");
exports.run = function (watchOpts, cb) {
    if (watchOpts.watchPer) {
        logging_1.default.warning('running watchPer');
        require('./lib/watch-per').run(watchOpts, cb);
    }
    else {
        logging_1.default.warning('running regular shit');
        require('./start-watching').run(watchOpts, cb);
    }
};
