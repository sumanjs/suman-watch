'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var path = require("path");
var logging_1 = require("./lib/logging");
var async = require("async");
var suman_utils_1 = require("suman-utils");
var chokidar = require("chokidar");
var make_transpile_1 = require("./lib/make-transpile");
var make_execute_1 = require("./lib/make-execute");
var make_transpile_all_1 = require("./lib/make-transpile-all");
exports.startWatching = function (watchOpts, cb) {
    var onSIG = function () {
        logging_1.logInfo('suman watch is exiting.');
        process.exit(139);
    };
    process.on('SIGINT', onSIG);
    process.on('SIGTERM', onSIG);
    var projectRoot = suman_utils_1.default.findProjectRoot(process.cwd());
    var testSrcDir = process.env['TEST_SRC_DIR'];
    var transpile = make_transpile_1.makeTranspile(watchOpts, projectRoot);
    var transpileAll = make_transpile_all_1.makeTranspileAll(watchOpts, projectRoot);
    var execute = make_execute_1.makeExecute(watchOpts, projectRoot);
    async.autoInject({
        getTransformPaths: function (cb) {
            if (watchOpts.noTranspile) {
                logging_1.logInfo('watch process will not get all transform paths, because we are not transpiling.');
                return process.nextTick(cb);
            }
            suman_utils_1.default.findSumanMarkers(['@run.sh', '@transform.sh'], testSrcDir, [], cb);
        },
        transpileAll: function (getTransformPaths, cb) {
            if (watchOpts.noTranspile) {
                logging_1.logInfo('watch process will not run transpile-all routine, because we are not transpiling.');
                return process.nextTick(cb);
            }
            var paths = Object.keys(getTransformPaths).filter(function (key) {
                return getTransformPaths[key]['@transform.sh'];
            })
                .map(function (k) {
                return path.resolve(k + '/@transform.sh');
            });
            transpileAll(paths, cb);
        }
    }, function (err, results) {
        if (err) {
            throw err;
        }
        console.log('\n');
        logging_1.logGood('Transpilation results:');
        results.transpileAll.forEach(function (t) {
            if (t.code > 0) {
                logging_1.logError('transform result error => ', util.inspect(t));
            }
            else {
                logging_1.logGood('transform result => ', util.inspect(t));
            }
        });
        var watcher = chokidar.watch(testSrcDir, {
            ignored: /(\/@target\/|\/node_modules\/|@run.sh$|@transform.sh$|.*\.log$|.*\.json$)/,
            persistent: true,
            ignoreInitial: true
        });
        watcher.on('error', function (e) {
            logging_1.logError('watcher experienced an error', e.stack || e);
        });
        watcher.once('ready', function () {
            logging_1.logVeryGood('watcher is ready.');
            logging_1.logVeryGood('watched paths => \n', util.inspect(watcher.getWatched()));
            cb && cb(null, {
                watched: watcher.getWatched()
            });
        });
        watcher.on('change', function (f) {
            logging_1.logInfo('file change event for path => ', f);
            suman_utils_1.default.findNearestRunAndTransform(projectRoot, f, function (err, ret) {
                if (err) {
                    logging_1.logError("error locating @run.sh / @transform.sh for file " + f + ".\n" + err);
                    return;
                }
                transpile(f, ret.transform, function (err) {
                    if (err) {
                        logging_1.logError("error running transpile process for file " + f + ".\n" + err);
                        return;
                    }
                    execute(f, ret.run, function (err, result) {
                        if (err) {
                            logging_1.logError("error executing corresponding test process for source file " + f + ".\n" + (err.stack || err));
                            return;
                        }
                        var stdout = result.stdout, stderr = result.stderr, code = result.code;
                        logging_1.logInfo("you corresponding test process for path " + f + ", exited with code " + code);
                        if (code > 0) {
                            logging_1.logError("there was an error executing your test with path " + f + ", because the exit code was greater than 0.");
                        }
                        if (stderr) {
                            logging_1.logWarning("the stderr for path " + f + ", is as follows =>\n" + stderr + ".");
                        }
                        if (stdout) {
                            logging_1.logInfo("the stderr for path " + f + ", is as follows =>\n" + stdout + ".");
                        }
                    });
                });
            });
        });
    });
};
