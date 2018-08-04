'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const residence = require("residence");
const dashdash = require('dashdash');
const index = require(".");
const logging_1 = require("./lib/logging");
const projectRoot = residence.findProjectRoot(process.cwd());
if (!projectRoot) {
    logging_1.default.error('your project root could not be found.');
    process.exit(1);
}
let sumanConf;
try {
    sumanConf = require(projectRoot + '/suman.conf.js');
}
catch (err) {
    logging_1.default.error('cannot find suman.conf.js in your project root.');
    logging_1.default.error(`your project root was presumed to be: ${projectRoot}.`);
    process.exit(1);
}
let testDir = process.env.TEST_DIR = sumanConf.testDir;
if (!testDir) {
    testDir = process.env.TEST_DIR = path.resolve(projectRoot + '/test');
}
logging_1.default.info('testDir => ', testDir);
const options = require('./lib/cmd-opts');
let opts, parser = dashdash.createParser({ options });
try {
    opts = parser.parse(process.argv);
}
catch (e) {
    console.error('There was an error parsing a Suman-Watch CLI option:\n%s', e.message);
    process.exit(1);
}
logging_1.default.info("# opts:", opts);
logging_1.default.info("# args:", opts._args);
if (opts.help) {
    var help = parser.help({ includeEnv: true }).trimRight();
    console.log('usage: node foo.js [OPTIONS]\n'
        + 'options:\n'
        + help);
    process.exit(0);
}
index.run(opts, function (err) {
    if (err)
        throw err;
    logging_1.default.good('watch process ready.');
});
