"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var cp = require("child_process");
var fs = require("fs");
var suman_utils_1 = require("suman-utils");
var logging_1 = require("./logging");
var bashPool = [];
exports.makeExecute = function (watchOptions, projectRoot) {
    return function (f, runData, $cb) {
        var cb = suman_utils_1.default.once(this, $cb);
        var runPath;
        var runLength = runData.run ? runData.run.length : 0;
        if (runData.config && runData.config.length > runLength) {
            try {
                var config = require(runData.config);
                var plugin = config['@run']['plugin']['value'];
                if (plugin) {
                    runPath = require(plugin).getRunPath();
                }
            }
            catch (err) {
                logging_1.logError(err.stack || err);
            }
        }
        if (!runPath) {
            if (runData.run) {
                runPath = runData.run;
            }
        }
        suman_utils_1.default.makePathExecutable(runPath || f, function (err) {
            if (err) {
                return cb(err);
            }
            var k;
            if (runPath) {
                console.log('runPath => ', runPath);
                k = cp.spawn('bash', [], {
                    cwd: projectRoot,
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                    env: Object.assign({}, process.env, {
                        SUMAN_TEST_PATHS: JSON.stringify([f]),
                        SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
                    })
                });
                fs.createReadStream(runPath).pipe(k.stdin);
            }
            else {
                console.log('file path  => ', f);
                k = cp.spawn(f, [], {
                    cwd: projectRoot,
                    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                    env: Object.assign({}, process.env, {
                        SUMAN_TEST_PATHS: JSON.stringify([f]),
                        SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
                    })
                });
            }
            var stdout = '';
            k.stdout.setEncoding('utf8');
            k.stdout.pipe(process.stdout);
            k.stdout.on('data', function (d) {
                stdout += d;
            });
            var stderr = '';
            k.stderr.setEncoding('utf8');
            k.stderr.pipe(process.stderr);
            k.stderr.on('data', function (d) {
                stderr += d;
            });
            k.once('exit', function (code) {
                cb(null, {
                    path: f,
                    runPath: runPath,
                    code: code,
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            });
        });
    };
};
