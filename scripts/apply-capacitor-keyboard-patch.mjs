import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = resolve(root, 'node_modules/@capacitor/keyboard');
const patchPath = resolve(root, 'patches/@capacitor__keyboard@8.0.5.patch');
const sourcePath = resolve(packageRoot, 'ios/Sources/KeyboardPlugin/Keyboard.m');

if (!existsSync(packageRoot) || !existsSync(patchPath) || !existsSync(sourcePath)) {
    console.log('[UwU Keyboard] Capacitor Keyboard package or patch is not installed yet.');
    process.exit(0);
}

const patch = readFileSync(patchPath, 'utf8');
const isApplied = source => source.includes('setKeyboardHeight:(int)height duration:(NSTimeInterval)duration')
    && source.includes('animationOptionsForKeyboardCurve')
    && !source.includes('duration]+0.2');

if (isApplied(readFileSync(sourcePath, 'utf8'))) {
    console.log('[UwU Keyboard] Capacitor animation patch already applied.');
    process.exit(0);
}

const result = spawnSync('/usr/bin/patch', ['--batch', '--forward', '-p1'], {
    cwd: packageRoot,
    input: patch,
    encoding: 'utf8',
});

if (result.status !== 0 || !isApplied(readFileSync(sourcePath, 'utf8'))) {
    process.stderr.write(result.stderr || '[UwU Keyboard] Failed to apply Capacitor animation patch.\n');
    process.exit(result.status || 1);
}

console.log('[UwU Keyboard] Applied native animation patch.');
