const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { join } = require('node:path');

test('lists app ships a local-first multiple-list interface', async () => {
  const html = await readFile(join(__dirname, '../lists/index.html'), 'utf8');
  const js = await readFile(join(__dirname, '../lists/app.js'), 'utf8');

  assert.match(html, /Lists for anything/);
  assert.match(html, /New list/);
  assert.match(html, /Your lists/);
  assert.match(html, /List notes/);
  assert.match(html, /Export JSON/);
  assert.match(html, /Import JSON/);
  assert.match(html, /No sign-in required/);
  assert.match(html, /Gun sync/);
  assert.match(html, /Sync key/);
  assert.match(html, /cdn\.jsdelivr\.net\/npm\/gun\/gun\.js/);
  assert.match(html, /Saved on this device|Local mode|Saved locally/);
  assert.match(html, /<script type="module" src="app\.js"><\/script>/);

  assert.match(js, /STORAGE_KEY = 'tmsteph\.lists\.v1'/);
  assert.match(js, /SYNC_KEY_STORAGE_KEY = 'tmsteph\.lists\.syncKey\.v1'/);
  assert.match(js, /GUN_PEERS/);
  assert.match(js, /wss:\/\/relay\.3dvr\.tech\/gun/);
  assert.match(js, /Rosarito list/);
  assert.match(js, /Buy dish soap/);
  assert.match(js, /Fix the toilet/);
  assert.match(js, /Shut off the water valve/);
  assert.match(js, /localStorage/);
  assert.match(js, /Memory mode/);
  assert.match(js, /exportState/);
  assert.match(js, /importState/);
  assert.match(js, /connectGunSync/);
  assert.match(js, /publishState/);
  assert.match(js, /normalizeState/);
});

test('homepage links to the lists app', async () => {
  const html = await readFile(join(__dirname, '../index.html'), 'utf8');

  assert.match(html, /href="lists\/"/);
  assert.match(html, /Lists app/);
});
