#!/usr/bin/env node
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var path = require("path");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var chalk = require("chalk");
var make_transpile_1 = require("./lib/make-transpile");
var make_execute_1 = require("./lib/make-execute");
var utils_1 = require("./lib/utils");
var logging_1 = require("./lib/logging");
var testDir = process.env['TEST_DIR'];
var ignored = JSON.parse(process.env['SUMAN_TOTAL_IGNORED']);
var projectRoot = process.env['SUMAN_PROJECT_ROOT'];
var watchOpts = JSON.parse(process.env['SUMAN_WATCH_OPTS']);
var transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
var execute = make_execute_1.makeExecute(watchOpts, projectRoot);
var watcher = chokidar.watch(testDir, {
    persistent: true,
    ignoreInitial: true,
    ignored: utils_1.getAlwaysIgnore().concat(ignored).map(function (v) { return new RegExp(v); })
});
watcher.on('error', function (e) {
    logging_1.logError('watcher experienced an error', e.stack || e);
});
watcher.once('ready', function () {
    logging_1.logVeryGood('watcher is ready.');
    var watchCount = 0;
    var watched = watcher.getWatched();
    Object.keys(watched).forEach(function (k) {
        watchCount += watched[k].length;
    });
    logging_1.logVeryGood('number of files being watched by suman-watch => ', watchCount);
});
watcher.on('change', function (f) {
    if (!path.isAbsolute(f)) {
        f = path.resolve(projectRoot + '/' + f);
    }
    logging_1.logInfo('file change event for path => ', f);
    suman_utils_1.default.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
        if (err) {
            logging_1.logError("error locating @run.sh / @transform.sh for file " + f + ".\n" + err);
            return;
        }
        transpile(f, ret, function (err) {
            if (err) {
                logging_1.logError("error running transpile process for file " + f + ".\n" + err);
                return;
            }
            execute(f, ret, function (err, result) {
                if (err) {
                    logging_1.logError("error executing corresponding test process for source file " + f + ".\n" + (err.stack || err));
                    return;
                }
                var stdout = result.stdout, stderr = result.stderr, code = result.code;
                console.log('\n');
                console.error('\n');
                logging_1.logInfo("your corresponding test process for path " + f + ", exited with code " + code);
                if (code > 0) {
                    logging_1.logError("there was an error executing your test with path " + f + ", because the exit code was greater than 0.");
                }
                if (stderr) {
                    logging_1.logWarning("the stderr for path " + f + ", is as follows =>\n" + chalk.yellow(stderr) + ".");
                    console.error('\n');
                }
                if (stdout) {
                    logging_1.logInfo("the stdout for path " + f + ", is as follows =>\n" + stdout + ".");
                    console.log('\n');
                }
            });
        });
    });
});
