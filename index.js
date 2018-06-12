'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const utils_1 = require("./lib/utils");
const logging_1 = require("./lib/logging");
exports.runWatch = function (projectRoot, paths, sumanConfig, sumanOpts, cb) {
    let callable = true;
    let once = function () {
        if (callable) {
            callable = false;
            cb.apply(this, arguments);
        }
    };
    let makeRun;
    if (sumanOpts.watch_per) {
        let { watchObj } = utils_1.default.getWatchObj(projectRoot, sumanOpts, sumanConfig);
        if (watchObj.plugin) {
            logging_1.log.info('running "watch-per" * using suman-watch plugin *.');
            makeRun = require('./lib/watch-per-with-plugin').makeRun;
        }
        else {
            logging_1.log.info('running "watch-per".');
            makeRun = require('./lib/watch-per').makeRun;
        }
    }
    else {
        logging_1.log.info('Running standard test script watcher.');
        logging_1.log.info('When changes are saved to a test script, that test script will be executed.');
        makeRun = require('./lib/start-watching').makeRun;
    }
    assert(typeof makeRun === 'function', 'Suman implementation error - the desired suman-watch module does not export the expected interface.');
    process.stdin.setEncoding('utf8').resume();
    const run = makeRun(projectRoot, paths, sumanOpts);
    run(sumanConfig, false, once);
};
exports.plugins = require('suman-watch-plugins');
