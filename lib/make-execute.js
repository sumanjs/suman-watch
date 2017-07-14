'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var path = require("path");
var cp = require("child_process");
var fs = require("fs");
var net = require("net");
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
                logging_1.default.error(err.stack || err);
            }
        }
        if (!runPath) {
            if (runData.run) {
                runPath = runData.run;
            }
        }
        var k;
        if (runPath) {
            console.log('runPath => ', runPath);
            k = cp.spawn('bash', [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                env: Object.assign({}, process.env, {
                    SUMAN_PROJECT_ROOT: projectRoot,
                    SUMAN_TEST_PATHS: JSON.stringify([f]),
                    SUMAN_ALWAYS_INHERIT_STDIO: 'yes',
                    SUMAN_CHILD_TEST_PATH: f,
                })
            });
            fs.createReadStream(runPath).pipe(k.stdin);
        }
        else {
            if (String(f).endsWith('.js')) {
                var noDaemon_1 = function () {
                    k = cp.spawn('node', [f], {
                        detached: false,
                        cwd: projectRoot,
                        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                        env: Object.assign({}, process.env, {
                            SUMAN_PROJECT_ROOT: projectRoot,
                            SUMAN_CHILD_TEST_PATH: f,
                            SUMAN_TEST_PATHS: JSON.stringify([f]),
                            SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
                        })
                    });
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
                };
                var client_1 = net.createConnection({ port: 9091 }, function () {
                    console.log('connected to server!');
                    var cwdDir = path.dirname(f);
                    console.log('cwd-dir => ', cwdDir);
                    client_1.write(JSON.stringify({ pid: -1, cwd: cwdDir, args: [f] }) + '\r\n');
                });
                client_1.once('error', function (e) {
                    if (/ECONNREFUSED/.test(e.message)) {
                        noDaemon_1();
                    }
                    else {
                        console.error('client connect error => ', e.stack || e);
                        cb(e);
                    }
                });
                var endOk_1 = false;
                client_1.once('data', function () {
                    endOk_1 = true;
                });
                client_1.pipe(process.stdout);
                client_1.on('end', function () {
                    if (endOk_1) {
                        cb(null, {
                            path: f,
                            runPath: runPath,
                            code: null,
                            stdout: '',
                            stderr: ''
                        });
                    }
                });
            }
            else {
                console.log('file path  => ', f);
                k = cp.spawn(f, [], {
                    detached: false,
                    cwd: projectRoot,
                    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
                    env: Object.assign({}, process.env, {
                        SUMAN_PROJECT_ROOT: projectRoot,
                        SUMAN_CHILD_TEST_PATH: f,
                        SUMAN_TEST_PATHS: JSON.stringify([f]),
                        SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
                    })
                });
                var stdout_1 = '';
                k.stdout.setEncoding('utf8');
                k.stdout.pipe(process.stdout);
                k.stdout.on('data', function (d) {
                    stdout_1 += d;
                });
                var stderr_1 = '';
                k.stderr.setEncoding('utf8');
                k.stderr.pipe(process.stderr);
                k.stderr.on('data', function (d) {
                    stderr_1 += d;
                });
                k.once('exit', function (code) {
                    cb(null, {
                        path: f,
                        runPath: runPath,
                        code: code,
                        stdout: String(stdout_1).trim(),
                        stderr: String(stderr_1).trim()
                    });
                });
            }
        }
    };
};
