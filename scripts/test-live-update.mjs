import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const config = JSON.parse(read('capacitor.config.json'));
const scripts = read('src/html/scripts.html');
const runtime = read('js/modules/live-update.js');

assert.equal(config.appId, 'com.mirelle.xinuwu');
assert.equal(config.webDir, 'www');
assert.equal(config.server?.url, undefined, 'remote server.url would change the WebView storage origin');
assert.equal(config.plugins?.LiveUpdate?.readyTimeout, 0);
assert.match(scripts, /js\/modules\/live-update\.js/);
assert.match(runtime, /Capacitor\?\.Plugins\?\.LiveUpdate/);
assert.match(runtime, /getCurrentBundle/);
assert.match(runtime, /getDownloadedBundles/);
assert.match(runtime, /downloadBundle/);
assert.match(runtime, /setNextBundle/);
assert.match(runtime, /mirellefeatherstone\/xinOVO\/releases/);

console.log('Live update wiring preserves the local origin and custom release channel.');
