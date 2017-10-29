'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var util = require("util");
var assert = require("assert");
var path = require("path");
var cp = require("child_process");
var logging_1 = require("./logging");
var su = require("suman-utils");
var chokidar = require("chokidar");
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
        var pluginName = plugin.pluginName || 'unknown-watch-plugin';
        var stdoutStartTranspileRegex = plugin.stdoutStartTranspileRegex;
        var stdoutEndTranspileRegex = plugin.stdoutEndTranspileRegex;
        var pluginEnv = plugin.pluginEnv || {};
        assert(su.isObject(pluginEnv), '"env" property on plugin must be a plain object.');
        var testEnv = watchObj.env || {};
        assert(su.isObject(testEnv), '"env" property on watch object must be a plain object.');
        var execTests = watchObj.exec || plugin.execTests;
        var pluginExec = plugin.pluginExec;
        assert(su.isStringWithPositiveLn(execTests), '"execTests" property on plugin value must be a string with length greater than zero;\n' +
            'if no "execTests" property is used on the pluging, an "exec" property must be defined on the watch per object.');
        assert(su.isStringWithPositiveLn(pluginExec), '"execTransform" property on plugin object value must be a string with length greater than zero.');
        assert(stdoutStartTranspileRegex, '"stdoutStartTranspileRegex" property needs to be defined as a String or RegExp.');
        assert(stdoutEndTranspileRegex, '"stdoutEndTranspileRegex" property needs to be defined as a String or RegExp.');
        var details = {
            exitOk: false
        };
        var createWatcherPluginProcess = function () {
            var k = cp.spawn('bash', [], {
                cwd: plugin.cwd || process.cwd(),
                env: Object.assign({}, process.env, pluginEnv, {
                    SUMAN_WATCH_PLUGIN_RUN: 'yes'
                })
            });
            cb && k.once('error', cb);
            k.stdout.pipe(prepend_transform_1.default(chalk.grey(" [" + pluginName + "-worker] "))).pipe(process.stdout);
            k.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(" [" + pluginName + "-worker] "), { omitWhitespace: true })).pipe(process.stderr);
            setImmediate(function () {
                k.stdin.end('\n' + pluginExec + '\n');
            });
            k.once('exit', function () {
                if (!details.exitOk) {
                    logging_1.log.warning('watcher process exitted (perhaps unexpectedly), to restart watch process, send "rs" to stdin.');
                }
            });
            return k;
        };
        var watcherPluginProcess = {
            k: createWatcherPluginProcess()
        };
        var testProcessWorker = {
            k: null
        };
        var killTestProcess = function () {
            testProcessWorker.k && logging_1.log.warning('killing currenctly running test(s).');
            testProcessWorker.k && testProcessWorker.k.kill('SIGKILL');
            setTimeout(function () {
                testProcessWorker.k && testProcessWorker.k.kill('SIGKILL');
            }, 3000);
        };
        var startTestProcess = function () {
            var testProcess = testProcessWorker.k = cp.spawn('bash', [], {
                env: Object.assign({}, process.env, testEnv, {
                    SUMAN_WATCH_TEST_RUN: 'yes'
                })
            });
            setImmediate(function () {
                testProcess.stdin.write('\n' + execTests + '\n');
                testProcess.stdin.end();
            });
            testProcess.stdout.pipe(prepend_transform_1.default(chalk.grey(" [suman-watch-test-process] "))).pipe(process.stdout);
            testProcess.stderr.pipe(prepend_transform_1.default(chalk.yellow.bold(" [suman-watch-test-process] "), { omitWhitespace: true })).pipe(process.stderr);
        };
        process.stdin.on('data', function onData(d) {
            if (String(d).trim() === 'rr') {
                logging_1.log.info('re-running test execution.');
                runNewTestProcess();
            }
            else if (String(d).trim() === 'rs') {
                process.stdin.removeListener('data', onData);
                restartWatcher('user restarted the process with "rs" stdin command.');
            }
            else {
                logging_1.log.info('stdin command not recognized.');
            }
        });
        var restartPluginWatcherThrottleTimeout;
        var restartPluginWatcherThrottle = function (reason) {
            clearTimeout(restartPluginWatcherThrottleTimeout);
            restartPluginWatcherThrottleTimeout = setTimeout(function () {
                restartWatcher(reason);
            }, 1000);
        };
        var restartWatcher = function (reason) {
            clearTimeout(restartPluginWatcherThrottleTimeout);
            logging_1.log.warning('restarting watch-per process' + (reason || '.'));
            watcherPluginProcess.k.kill('SIGKILL');
            setTimeout(function () {
                watcherPluginProcess.k.kill('SIGKILL');
            }, 2000);
            setImmediate(run, null, false, null);
        };
        var runNewTestProcess = function () {
            logging_1.log.veryGood(chalk.green.bold("Now running test process using: ") + ("'" + chalk.black.bold(execTests) + "'."));
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
        watcherPluginProcess.k.stderr.once('data', function (p) {
            cb && cb(String(p));
        });
        watcherPluginProcess.k.stdout.on('data', function (p) {
            cb && cb(null);
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
        var watcher = chokidar.watch('**/**/*.js', {
            cwd: projectRoot,
            persistent: true,
            ignoreInitial: true,
            ignored: /(\.log$|\/.idea\/|\/node_modules\/suman\/)/
        });
        watcher.on('error', function (e) {
            logging_1.log.error('suman-watch watcher experienced an error', e.stack || e);
        });
        watcher.once('ready', function () {
            logging_1.log.veryGood('watcher is ready.');
            var watchCount = 0;
            var watched = watcher.getWatched();
            Object.keys(watched).forEach(function (k) {
                var ln = watched[k].length;
                watchCount += ln;
            });
            logging_1.log.veryGood('total number of files being watched by suman-watch process ', watchCount);
        });
        watcher.on('change', function (p) {
            logging_1.log.good('change event, file path => ', chalk.gray(p));
            if (path.basename(p) === 'suman.conf.js') {
                restartPluginWatcherThrottle('suman.conf.js file changed.');
            }
        });
        watcher.on('add', function (file) {
            logging_1.log.info('file was added: ' + chalk.gray(file));
        });
        watcher.on('unlink', function (file) {
            logging_1.log.info('file was unlinked: ' + chalk.gray(file));
        });
    };
};
