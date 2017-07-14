import dashdash = require('dashdash');
import index = require('./index');

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

// Use `parser.help()` for formatted options help.
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

