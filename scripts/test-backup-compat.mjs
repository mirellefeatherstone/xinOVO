import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(
    fs.readFileSync(new URL('../js/data/backup-compat.js', import.meta.url), 'utf8'),
    { window }
);

const legacy = {
    characters: [{ id: 'char-1' }],
    globalCss: 'new-default',
    globalSettings: {
        globalCss: 'old-custom-css',
        bubbleCssPresets: [{ name: 'telegram' }],
        cotPresets: [{ id: 'cot-old' }],
        statusBarPresets: [{ id: 'status-old' }],
        homeWidgetPresets: [{ id: 'home-old' }]
    },
    theaterData: {
        theaterScenarios: [{ id: 'scene-old' }]
    }
};

const result = window.UwUBackupCompat.unwrapGroupedSettings(legacy);
assert.deepEqual(Array.from(result.groups), ['globalSettings', 'theaterData']);
assert.deepEqual(Array.from(result.restoredKeys).sort(), [
    'bubbleCssPresets', 'cotPresets', 'globalCss', 'homeWidgetPresets',
    'statusBarPresets', 'theaterScenarios'
].sort());
assert.equal(result.data.globalCss, 'old-custom-css');
assert.equal(result.data.globalSettings, undefined);
assert.equal(result.data.theaterData, undefined);
assert.equal(result.data.characters[0].id, 'char-1');
assert.equal(result.data.bubbleCssPresets[0].name, 'telegram');
assert.equal(result.data.cotPresets[0].id, 'cot-old');
assert.equal(result.data.statusBarPresets[0].id, 'status-old');
assert.equal(result.data.homeWidgetPresets[0].id, 'home-old');
assert.equal(result.data.theaterScenarios[0].id, 'scene-old');

const untouched = { globalCss: 'current', cotPresets: [] };
const current = window.UwUBackupCompat.unwrapGroupedSettings(untouched);
assert.deepEqual(Array.from(current.groups), []);
assert.equal(current.data.globalCss, 'current');

const indexedDbSource = fs.readFileSync(new URL('../js/data/indexed-db.js', import.meta.url), 'utf8');
const backupSource = fs.readFileSync(new URL('../js/modules/tutorial/backup-and-restore.js', import.meta.url), 'utf8');
assert.match(indexedDbSource, /UwUBackupCompat\?\.unwrapGroupedSettings\(settings\)/);
assert.match(indexedDbSource, /globalSettings\.bulkDelete\(groupedSettings\.groups\)/);
assert.match(backupSource, /UwUBackupCompat\?\.unwrapGroupedSettings\(data\)\.data/);

console.log('Backup compatibility tests passed: legacy grouped settings unwrap without changing current backups.');
