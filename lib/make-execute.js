'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var process = require('suman-browser-polyfills/modules/process');
var global = require('suman-browser-polyfills/modules/global');
var path = require("path");
var cp = require("child_process");
var fs = require("fs");
var net = require("net");
var su = require("suman-utils");
var prepend_transform_1 = require("prepend-transform");
var logging_1 = require("./logging");
process.stdout.setMaxListeners(80);
process.stderr.setMaxListeners(80);
exports.makeExecute = function (watchOptions, projectRoot) {
    return function (f, runData, $cb) {
        var cb = su.once(this, $cb);
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
        var handleStdioAndExit = function (k, runPath, f) {
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
        var k;
        if (runPath) {
            logging_1.default.info("executable path => '" + runPath + "'");
            k = cp.spawn('bash', [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: Object.assign({}, process.env, {
                    SUMAN_PROJECT_ROOT: projectRoot,
                    SUMAN_TEST_PATHS: JSON.stringify([f]),
                    SUMAN_ALWAYS_INHERIT_STDIO: 'yes',
                    SUMAN_CHILD_TEST_PATH: f,
                })
            });
            fs.createReadStream(runPath).pipe(k.stdin);
            handleStdioAndExit(k, runPath, null);
        }
        else if (String(f).endsWith('.js')) {
            var noDaemon_1 = function () {
                k = cp.spawn('node', [f], {
                    detached: false,
                    cwd: projectRoot,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: Object.assign({}, process.env, {
                        SUMAN_PROJECT_ROOT: projectRoot,
                        SUMAN_CHILD_TEST_PATH: f,
                        SUMAN_TEST_PATHS: JSON.stringify([f]),
                        SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
                    })
                });
                handleStdioAndExit(k, runPath, f);
            };
            var client_1 = net.createConnection({ port: 9091 }, function () {
                logging_1.default.good('connected to server!');
                var cwdDir = path.dirname(f);
                logging_1.default.good('cwd-dir => ', cwdDir);
                client_1.write(JSON.stringify({ pid: -1, cwd: cwdDir, args: [f] }) + '\r\n');
            });
            client_1.once('error', function (e) {
                if (/ECONNREFUSED/.test(e.message)) {
                    process.nextTick(noDaemon_1);
                }
                else {
                    logging_1.default.error('client connect error => ', e.stack || e);
                    process.nextTick(cb, e);
                }
            });
            var endOk_1 = false;
            client_1.once('data', function () {
                endOk_1 = true;
            });
            client_1.pipe(prepend_transform_1.default(" [watch-worker-via-daemon] ")).pipe(process.stdout);
            client_1.once('end', function () {
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
            logging_1.default.info("file path  => '" + f + "'");
            var extname = path.extname(f);
            if (['.html', '.json', '.xml', '.log', '.txt', '.d.ts', '.md'].some(function (v) { return String(f).endsWith(v); })) {
                logging_1.default.info("files with extension '" + extname + "' are currently ignored by suman-watch.");
                return process.nextTick(cb, null, { code: -1 });
            }
            k = cp.spawn(f, [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: Object.assign({}, process.env, {
                    SUMAN_PROJECT_ROOT: projectRoot,
                    SUMAN_CHILD_TEST_PATH: f,
                    SUMAN_TEST_PATHS: JSON.stringify([f]),
                    SUMAN_ALWAYS_INHERIT_STDIO: 'yes'
                })
            });
            k.once('error', function (e) {
                logging_1.default.error(e.stack || e);
            });
            handleStdioAndExit(k, runPath, f);
        }
    };
};
