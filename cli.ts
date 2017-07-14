import dashdash = require('dashdash');
import index = require('./index');
import residence = require('residence');
import path = require('path');
import log = require('./lib/logging');

const projectRoot = residence.findProjectRoot(process.cwd());

if (!projectRoot) {
  log.error('your project root could not be found.');
  process.exit(1);
}

let sumanConf;

try {
  sumanConf = require(projectRoot + '/suman.conf.js');
}
catch (err) {
  log.error('cannot find suman.conf.js in your project root.');
  log.error(`your project root was presumed to be: ${projectRoot}.`);
  process.exit(1);
}

let testDir = process.env.TEST_DIR = sumanConf.testDir;

if (!testDir) {
  testDir = process.env.TEST_DIR = path.resolve(projectRoot + '/test');
}

log.info('testDir => ', testDir);

const options = require('./lib/cmd-opts');
let opts, parser = dashdash.createParser({options});

try {
  opts = parser.parse(process.argv);
} catch (e) {
  console.error('foo: error: %s', e.message);
  process.exit(1);
}

console.log("# opts:", opts);
console.log("# args:", opts._args);

if (opts.help) {
  var help = parser.help({includeEnv: true}).trimRight();
  console.log('usage: node foo.js [OPTIONS]\n'
    + 'options:\n'
    + help);
  process.exit(0);
}

index.run(opts, function (err: Error) {
  if (err) {
    throw err;
  }
  console.log('watch process ready.')
});

