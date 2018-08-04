'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const process = require('suman-browser-polyfills/modules/process');
const global = require('suman-browser-polyfills/modules/global');
const assert = require("assert");
const path = require("path");
const cp = require("child_process");
const fs = require("fs");
const net = require("net");
const su = require("suman-utils");
const prepend_transform_1 = require("prepend-transform");
const chalk = require("chalk");
const logging_1 = require("./logging");
process.stdout.setMaxListeners(80);
process.stderr.setMaxListeners(80);
exports.makeExecute = function (watchOptions, projectRoot) {
    return function (f, runData, $cb) {
        const cb = su.once(this, $cb);
        let runPath, config, env;
        const runLength = runData.run ? runData.run.length : 0;
        if (runData.config && runData.config.length > runLength) {
            try {
                config = require(runData.config);
                env = config['@run'] && config['@run']['env'];
                const pluginValue = config['@run']['plugin']['value'];
                if (pluginValue) {
                    runPath = require(pluginValue).getRunPath();
                }
            }
            catch (err) {
                logging_1.default.warning('no run plugin could be found to execute the test.');
            }
        }
        if (env) {
            assert(su.isObject(env), 'env must be a plain object.');
        }
        let getEnv = function () {
            let basic = env || {};
            return Object.assign({}, process.env, basic, {
                SUMAN_PROJECT_ROOT: projectRoot,
                SUMAN_CHILD_TEST_PATH: f,
                SUMAN_TEST_PATHS: JSON.stringify([f]),
                SUMAN_ALWAYS_INHERIT_STDIO: 'yes',
                SUMAN_WATCH_TEST_RUN: 'yes'
            });
        };
        if (!runPath) {
            if (runData.run) {
                logging_1.default.warning('runPath has been found.');
                runPath = runData.run;
            }
            else {
                logging_1.default.warning('runPath has not been found.');
            }
        }
        let handleStdioAndExit = function (k, runPath, f) {
            k.once('error', function (e) {
                logging_1.default.error(e.stack || e);
            });
            let stdout = '';
            k.stdout.setEncoding('utf8');
            k.stdout.pipe(prepend_transform_1.pt(chalk.grey(' [watch-worker-exec] '))).pipe(process.stdout);
            k.stdout.on('data', function (d) {
                stdout += d;
            });
            let stderr = '';
            k.stderr.setEncoding('utf8');
            k.stderr.pipe(prepend_transform_1.pt(chalk.yellow.bold(' [watch-worker-exec] '), { omitWhitespace: true })).pipe(process.stderr);
            k.stderr.on('data', function (d) {
                stderr += d;
            });
            k.once('exit', function (code) {
                k.removeAllListeners();
                cb(null, {
                    path: f,
                    runPath,
                    code,
                    stdout: String(stdout).trim(),
                    stderr: String(stderr).trim()
                });
            });
        };
        let k;
        if (runPath) {
            logging_1.default.info(`executable path => '${runPath}'`);
            k = cp.spawn('bash', [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: getEnv()
            });
            fs.createReadStream(runPath).pipe(k.stdin);
            handleStdioAndExit(k, runPath, null);
        }
        else if (String(f).endsWith('.js')) {
            let noDaemon = function () {
                k = cp.spawn('bash', [], {
                    detached: false,
                    cwd: projectRoot,
                    stdio: ['pipe', 'pipe', 'pipe'],
                    env: getEnv()
                });
                k.stdin.end(`\nnode ${f};\n`);
                handleStdioAndExit(k, runPath, f);
            };
            const client = net.createConnection({ port: 9091 }, () => {
                logging_1.default.good('connected to server!');
                const cwdDir = path.dirname(f);
                logging_1.default.good('cwd-dir => ', cwdDir);
                client.write(JSON.stringify({ pid: -1, cwd: cwdDir, args: [f] }) + '\r\n');
            });
            client.once('error', function (e) {
                if (/ECONNREFUSED/.test(e.message)) {
                    process.nextTick(noDaemon);
                }
                else {
                    logging_1.default.error('client connect error => ', e.stack || e);
                    process.nextTick(cb, e);
                }
            });
            let endOk = false;
            client.once('data', function () {
                endOk = true;
            });
            client.pipe(prepend_transform_1.pt(` [watch-worker-via-daemon] `)).pipe(process.stdout);
            client.once('end', () => {
                if (endOk) {
                    cb(null, {
                        path: f,
                        runPath,
                        code: null,
                        stdout: '',
                        stderr: ''
                    });
                }
            });
        }
        else {
            logging_1.default.info(`file path  => '${f}'`);
            let extname = path.extname(f);
            if (['.html', '.json', '.xml', '.log', '.txt', '.d.ts', '.md'].some(v => String(f).endsWith(v))) {
                logging_1.default.info(`files with extension '${extname}' are currently ignored by suman-watch.`);
                return process.nextTick(cb, null, { code: -1 });
            }
            k = cp.spawn('bash', [], {
                detached: false,
                cwd: projectRoot,
                stdio: ['pipe', 'pipe', 'pipe'],
                env: getEnv()
            });
            k.stdin.end(`\nexec ${f};\n`);
            handleStdioAndExit(k, runPath, f);
        }
    };
};
