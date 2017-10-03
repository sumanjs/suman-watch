'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var logging_1 = require("./lib/logging");
exports.runWatch = function (projectRoot, paths, sumanConfig, sumanOpts, cb) {
    var makeRun = (sumanOpts.watch_per ? require('./lib/watch-per') : require('./lib/start-watching')).makeRun;
    {
        if (sumanOpts.watch_per) {
            logging_1.default.info('running watch-per');
        }
        else {
            logging_1.default.info('Running standard test script watcher.');
            logging_1.default.info('When changes are saved to a test script, that test script will be executed.');
        }
    }
    process.stdin.setEncoding('utf8').resume();
    var run = makeRun(projectRoot, paths, sumanOpts);
    run(sumanConfig, false, cb);
};
