'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var path = require("path");
var cp = require("child_process");
var fs = require("fs");
var async = require("async");
var suman_utils_1 = require("suman-utils");
var logging_1 = require("./logging");
exports.makeTranspileAll = function (watchOpts, projectRoot) {
    return function (transformPaths, cb) {
        var sumanConfig = require(path.resolve(projectRoot + '/suman.conf.js'));
        async.mapLimit(transformPaths, 5, function (t, $cb) {
            var cb = suman_utils_1.default.once(this, $cb);
            suman_utils_1.default.findApplicablePathsGivenTransform(sumanConfig, t.basePath, function (err, results) {
                if (err) {
                    return cb(err);
                }
                fs.chmod(t.bashFilePath, '777', function (err) {
                    if (err) {
                        return cb(err);
                    }
                    var uniqueResults = results.filter(function (r, i) {
                        return results.indexOf(r) === i;
                    });
                    var k = cp.spawn('bash', [], {
                        cwd: t.cwd,
                        env: Object.assign({}, process.env, {
                            SUMAN_TEST_PATHS: JSON.stringify(uniqueResults),
                            SUMAN_TRANSFORM_ALL_SOURCES: 'yes'
                        })
                    });
                    fs.createReadStream(t.bashFilePath).pipe(k.stdin);
                    var to = setTimeout(function () {
                        k.kill('SIGINT');
                        cb(new Error("transform all process timed out for the @transform.sh file at path \"" + t + "\"."), {
                            path: t,
                            stdout: String(stdout).trim(),
                            stderr: String(stderr).trim()
                        });
                    }, 1000000);
                    k.once('error', function (e) {
                        logging_1.logError("spawn error for path => \"" + t + "\" =>\n" + (e.stack || e));
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
                    k.once('exit', function (code) {
                        clearTimeout(to);
                        cb(null, {
                            path: t,
                            code: code,
                            stdout: String(stdout).trim(),
                            stderr: String(stderr).trim()
                        });
                    });
                });
            });
        }, cb);
    };
};
