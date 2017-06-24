const cp = require('child_process');

/////////////////////////////////////////////

module.exports = function (f, ret) {

  const toBeRun = (ret.run || f);
  console.log('executing...5', '\n', toBeRun, '\n', ret);

  let k;

  if (ret.run) {
    k = cp.spawn('bash', [], {
      stdio: ['pipe', 'inherit', 'inherit']
    });

    // TODO: make run.sh file executable first
    k.stdin.write('\n' + `suman --runner ${toBeRun} --inherit-stdio --force-match` + '\n');
    process.nextTick(function () {
      k.stdin.end();
    });
  }
  else {
    k = cp.spawn(toBeRun, [], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: Object.assign({}, process.env, {
        SUMAN_CHILD_TEST_PATH: f
      })
    });
  }

  k.once('close', function (code) {
    if (code > 0) {
      console.error(' *** [suman-watch] => There was an error executing your tests, exit code was', code);
    }
    else {
      console.log(' *** [suman-watch] => Test file finished with an exit code of 0.');
    }
  });

};