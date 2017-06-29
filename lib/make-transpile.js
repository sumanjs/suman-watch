'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var fs = require("fs");
var util = require("util");
var cp = require("child_process");
var suman_utils_1 = require("suman-utils");
var logging_1 = require("./logging");
exports.makeTranspile = function (watchOpts, projectRoot) {
    return function transpile(f, transformData, $cb) {
        var cb = suman_utils_1.default.once(this, $cb);
        console.log('transformData => ', util.inspect(transformData));
        var transformPath;
        var transformLength = transformData.transform ? transformData.transform.length : 0;
        if (transformData.config && transformData.config.length >= transformLength) {
            try {
                var config = require(transformData.config);
                console.log('config => ', config);
                var plugin = config['@transform']['plugin']['value'];
                console.log(' plugin => ', plugin);
                if (plugin) {
                    transformPath = require(plugin).getTransformPath();
                }
            }
            catch (err) {
                logging_1.logError(err.stack || err);
            }
        }
        if (!transformPath) {
            if (transformData.transform) {
                transformPath = transformData.transform;
            }
            else {
                return process.nextTick(cb, new Error('no transform path could be found.'));
            }
        }
        suman_utils_1.default.makePathExecutable(transformPath, function (err) {
            if (err) {
                return cb(err);
            }
            var k = cp.spawn('bash', [], {
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: Object.assign({}, process.env, {
                    SUMAN_TEST_PATHS: JSON.stringify([f]),
                    SUMAN_TRANSFORM_ALL_SOURCES: 'no'
                })
            });
            console.log('transform path => ', transformPath);
            fs.createReadStream(transformPath).pipe(k.stdin);
            k.once('error', function (e) {
                logging_1.logError("transform process experienced spawn error for path \"" + f + "\" =>\n" + (e.stack || e) + ".");
            });
            var stdout = '';
            k.stdout.setEncoding('utf8');
            k.stdout.on('data', function (d) {
                stdout += d;
            });
            var stderr = '';
            k.stderr.setEncoding('utf8');
            k.stderr.on('data', function (d) {
                stderr += d;
            });
            var to = setTimeout(function () {
                cb(new Error("transform process timed out for path \"" + f + "\"."), {
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            }, 1000000);
            k.once('exit', function (code) {
                clearTimeout(to);
                var err;
                if (code > 0) {
                    console.error(' => There was an error transforming your tests.');
                    err = new Error("transform process at path \"" + f + "\" exited with non-zero exit code =>\n" + stderr);
                }
                cb(err, {
                    code: code,
                    path: f,
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            });
        });
    };
};
