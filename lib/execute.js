const cp = require('child_process');

/////////////////////////////////////////////

module.exports = function (f, ret) {

  console.log('executing...', f, '\n', ret);

  const k = cp.spawn((ret.run || f), [], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: Object.assign({}, process.env, {
      SUMAN_CHILD_TEST_PATH: f
    })
  });

  k.once('close', function (code) {
    if (code > 0) {
      console.error(' => There was an error executing your tests.');
    }
    else {
      console.log(' => Test file finished.');
    }
  });

};