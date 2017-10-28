'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var assert = require("assert");
var cp = require("child_process");
var logging_1 = require("./logging");
var su = require("suman-utils");
var chalk = require("chalk");
var prepend_transform_1 = require("prepend-transform");
var utils_1 = require("./utils");
var alwaysIgnore = utils_1.default.getAlwaysIgnore();
exports.makeRun = function (projectRoot, paths, sumanOpts) {
    return function run($sumanConfig, isRunNow, cb) {
        var _a = utils_1.default.getWatchObj(projectRoot, sumanOpts, $sumanConfig), watchObj = _a.watchObj, sumanConfig = _a.sumanConfig;
        var plugin;
        assert(su.isObject(watchObj.plugin), 'watch object plugin value is not an object.');
        if (watchObj.plugin.isSumanWatchPluginModule) {
            plugin = watchObj.plugin.value;
        }
        else if (watchObj.plugin.isSumanWatchPluginValue) {
            plugin = watchObj.plugin;
        }
        else {
            throw new Error('watch object "plugin" value does not adhere to the expected interface => ' + util.inspect(watchObj));
        }
        var name = plugin.name || 'unknown-watch-plugin';
        var stdoutStartTranspileRegex = plugin.stdoutStartTranspileRegex;
        var stdoutEndTranspileRegex = plugin.stdoutEndTranspileRegex;
        var exec = watchObj.exec;
        var pluginExec = plugin.exec;
        assert(su.isStringWithPositiveLn(pluginExec), '"exec" property on plugin value must be a string with length greater than zero.');
        assert(su.isStringWithPositiveLn(exec), '"exec" property on watch object value must be a string with length greater than zero.');
        assert(stdoutStartTranspileRegex, '"stdoutStartTranspileRegex" property needs to be defined as a String or RegExp.');
        assert(stdoutEndTranspileRegex, '"stdoutEndTranspileRegex" property needs to be defined as a String or RegExp.');
        var createWatcher = function () {
            var k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, {
                    SUMAN_WATCH_TEST_RUN: 'yes'
                })
            });
            k.stdout.pipe(prepend_transform_1.default(chalk.grey(" [" + name + "-worker] "))).pipe(process.stdout);
            k.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(" [" + name + "-worker] "), { omitWhitespace: true })).pipe(process.stderr);
            return k;
        };
        var watcher = {
            k: createWatcher()
        };
        var testProcessWorker = {
            k: null
        };
        var killTestProcess = function () {
            testProcessWorker.k && logging_1.log.warning('killing currenctly running test(s).');
            testProcessWorker.k && testProcessWorker.k.kill('SIGINT');
            setTimeout(function () {
                testProcessWorker.k && testProcessWorker.k.kill('SIGKILL');
            }, 3000);
        };
        var startTestProcess = function () {
            var testProcess = testProcessWorker.k = cp.spawn('bash', [], {});
            setImmediate(function () {
                testProcess.stdin.write('\n' + exec + '\n');
                testProcess.stdin.end();
            });
            testProcess.stdout.pipe(prepend_transform_1.default(chalk.grey(" [" + name + "-tests] "))).pipe(process.stdout);
            testProcess.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(" [" + name + "-tests] "), { omitWhitespace: true })).pipe(process.stderr);
        };
        process.stdin.on('data', function onData(d) {
            if (String(d).trim() === 'rr') {
                logging_1.log.info('re-running test execution.');
                runNewTestProcess();
            }
            else if (String(d).trim() === 'rs') {
                logging_1.log.info('restarting watch-per process.');
                process.stdin.removeListener('data', onData);
                restartWatcher();
            }
            else {
                logging_1.log.info('stdin command not recognized.');
            }
        });
        var restartWatcher = function () {
            logging_1.log.warning('restarting watch-per process.');
            watcher.k.kill('SIGINT');
            setTimeout(function () {
                watcher.k.kill('SIGKILL');
            }, 2000);
            setImmediate(run, null, true, null);
        };
        var runNewTestProcess = function () {
            logging_1.log.good("now running test process using: '" + exec + "'.");
            killTestProcess();
            startTestProcess();
        };
        if (isRunNow) {
            runNewTestProcess();
        }
        var watcherStdio = {
            stdout: '',
            stderr: ''
        };
        watcher.k.stdout.on('data', function (p) {
            watcherStdio.stdout += String(p);
            if (stdoutStartTranspileRegex.test(watcherStdio.stdout)) {
                watcherStdio.stdout = '';
                killTestProcess();
            }
            if (stdoutEndTranspileRegex.test(watcherStdio.stdout)) {
                watcherStdio.stdout = '';
                runNewTestProcess();
            }
        });
    };
};
