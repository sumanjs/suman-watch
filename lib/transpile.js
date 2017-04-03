const cp = require('child_process');
const execute = require('./execute');

/////////////////////////////////////////////////////

module.exports = function (f, ret) {

  console.log(' => transpiling...', ret);

  const k = cp.spawn(ret.transform, [], {
    env: Object.assign({}, process.env, {
      SUMAN_CHILD_TEST_PATH: f
    })
  });

  let data = '';

  k.stdout.setEncoding('utf8');
  k.stdout.on('data', function (d) {
    console.log('data => ',d);
    data += d;
  });

  k.once('close', function (code) {
    if (code > 0) {
      console.error(' => There was an error transforming your tests.');
    }
    else {
      execute(String(data).trim(), ret);
    }
  });

};