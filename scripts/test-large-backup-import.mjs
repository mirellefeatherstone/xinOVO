import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/data/legacy-backup-stream.js', import.meta.url), 'utf8');
const context = {
    window: {}, Blob, Response, TextDecoder, Uint8Array,
    CompressionStream, DecompressionStream, Set, JSON, SyntaxError
};
vm.runInNewContext(source, context);

async function gzip(text) {
    return new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
}

async function collect(file) {
    const result = { values: {}, arrays: {}, objects: {} };
    await context.window.UwULegacyBackupStream.parse(file, {
        streamArrays: new Set(['characters', 'groups']),
        streamObjects: new Set(['globalSettings', 'theaterData', '__chunks__']),
        onValue(key, value) { result.values[key] = value; },
        onArrayItem(key, value) { (result.arrays[key] ||= []).push(value); },
        onObjectEntry(key, property, value) { (result.objects[key] ||= {})[property] = value; }
    });
    return result;
}

const largeText = `开头${'x'.repeat(300_000)}\\"{}[]结尾`;
const legacy = {
    characters: [{ id: 'a', history: [{ role: 'user', content: largeText }] }, { id: 'b', history: [] }],
    groups: [{ id: 'g', history: [{ role: 'assistant', content: '换行\n与括号 } ]' }] }],
    globalSettings: { bubbleCssPresets: [{ name: '旧 CSS', css: '.x{content:"}"}' }], cotSettings: { enabled: true } },
    theaterData: { theaterMode: 'html' },
    plainSetting: ['保留', { nested: true }],
    _exportVersion: '3.0'
};
for (const file of [new Blob([JSON.stringify(legacy)]), await gzip(JSON.stringify(legacy))]) {
    const parsed = await collect(file);
    assert.equal(parsed.arrays.characters.length, 2);
    assert.equal(parsed.arrays.characters[0].history[0].content, largeText);
    assert.equal(parsed.arrays.groups[0].history[0].content, '换行\n与括号 } ]');
    assert.equal(parsed.objects.globalSettings.bubbleCssPresets[0].name, '旧 CSS');
    assert.equal(parsed.objects.globalSettings.cotSettings.enabled, true);
    assert.equal(parsed.objects.theaterData.theaterMode, 'html');
    assert.deepEqual(parsed.values.plainSetting, ['保留', { nested: true }]);
    assert.equal(parsed.values._exportVersion, '3.0');
}

await assert.rejects(
    collect(new Blob([JSON.stringify(legacy).slice(0, -10)])),
    /不完整|格式|分隔符/
);

const backupRuntime = fs.readFileSync(new URL('../js/modules/tutorial/backup-and-restore.js', import.meta.url), 'utf8');
const toolsRuntime = fs.readFileSync(new URL('../js/modules/tutorial/content-and-data-tools.js', import.meta.url), 'utf8');
const githubRuntime = fs.readFileSync(new URL('../js/modules/tutorial/github-backup.js', import.meta.url), 'utf8');
assert.match(backupRuntime, /async function importLegacyStreamBackupData/);
assert.match(backupRuntime, /window\.importBackupFile = importBackupFile/);
assert.doesNotMatch(toolsRuntime, /new Response\(decompressedStream\)\.text\(\)/);
assert.doesNotMatch(githubRuntime, /new Response\(decompressedStream\)\.text\(\)/);
assert.match(toolsRuntime, /importBackupFile\(file/);
assert.match(githubRuntime, /importBackupFile\(archiveBlob/);

console.log('Large legacy backup streaming import checks passed.');
