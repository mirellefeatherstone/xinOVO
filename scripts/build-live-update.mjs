import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'updates');
const archive = resolve(output, 'xinovo-live-update.zip');
const requiredFiles = [
    'index.html',
    'js/modules/live-update.js',
    'js/modules/contacts-index.js',
    'js/modules/phone-keypad.js',
    'js/modules/wechat_emoji.js',
    'js/modules/wechat_game.js',
    'assets/wechat-emoji/order.json',
    'assets/wechat-game/dice-1.png',
];

for (const file of requiredFiles) {
    if (!existsSync(resolve(root, 'www', file))) throw new Error(`Live update bundle is missing ${file}`);
}

mkdirSync(output, { recursive: true });
rmSync(archive, { force: true });
const zipped = spawnSync('zip', ['-q', '-r', archive, '.'], {
    cwd: resolve(root, 'www'),
    encoding: 'utf8',
});
if (zipped.status !== 0) throw new Error(zipped.stderr || 'Failed to create live update bundle');

const listed = spawnSync('unzip', ['-Z1', archive], { encoding: 'utf8' });
if (listed.status !== 0) throw new Error(listed.stderr || 'Failed to inspect live update bundle');
const archiveFiles = new Set(listed.stdout.split(/\r?\n/).filter(Boolean));
for (const file of requiredFiles) {
    if (!archiveFiles.has(file)) throw new Error(`Live update archive is missing ${file}`);
}

const revision = spawnSync('git', ['rev-parse', '--short=12', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
});
if (revision.status !== 0) throw new Error(revision.stderr || 'Failed to read git revision');

const checksum = createHash('sha256').update(readFileSync(archive)).digest('hex');
const metadata = {
    bundleId: `live-${revision.stdout.trim()}`,
    checksum,
    asset: 'xinovo-live-update.zip',
};
writeFileSync(resolve(output, 'release-metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
console.log(`Built ${metadata.bundleId} (${checksum}).`);
