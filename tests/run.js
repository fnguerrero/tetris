/* run.js — corre todas las suites. Uso: node tests/run.js */
'use strict';
const fs = require('fs');
const path = require('path');
const H = require('./harness');

const files = fs.readdirSync(__dirname)
  .filter(f => f.endsWith('.test.js'))
  .sort();

console.log('TETRIS — suite de tests\n=======================');

for (const f of files) {
  try {
    require(path.join(__dirname, f))();
  } catch (e) {
    H.state.fail++;
    H.state.failures.push(f + ' / EXCEPCIÓN: ' + e.message);
    console.log('\n  EXCEPCIÓN en ' + f + ': ' + e.message);
    console.log(e.stack.split('\n').slice(1, 4).join('\n'));
  }
}

const total = H.state.pass + H.state.fail;
console.log('\n=======================');
if (H.state.fail) {
  console.log('FALLAS:');
  H.state.failures.forEach(x => console.log('  · ' + x));
}
console.log(H.state.pass + '/' + total + ' OK' + (H.state.fail ? ', ' + H.state.fail + ' FAIL' : ''));
process.exit(H.state.fail ? 1 : 0);
