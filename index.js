"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = function (projectRoot, watchOpts, cb) {
    if (watchOpts.watchPer) {
        require('./lib/watch-per').run(projectRoot, watchOpts, cb);
    }
    else {
        require('./start-watching').run(projectRoot, watchOpts, cb);
    }
};
