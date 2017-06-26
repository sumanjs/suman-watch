import {Pool} from "poolio";
import * as path from 'path';

/////////////////////////////////////////////////

const pool = new Pool({
  size: 3,
  filePath: path.resolve(__dirname + '/handle-require.js'),
  oneTimeOnly: true
});

pool.on('error', function (e: Error) {
  console.error(e.stack || e);
});

export const workerPool = pool;