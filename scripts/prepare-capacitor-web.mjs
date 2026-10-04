import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'www');
const files = [
    'index.html',
    'style.css',
    'contacts.css',
    'more_menu.css',
    'manifest.json',
    'sw.js',
    'sw-assets.js',
];
const directories = ['js', 'css', 'assets'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of files) {
    await cp(resolve(root, file), resolve(output, file));
}
for (const directory of directories) {
    await cp(resolve(root, directory), resolve(output, directory), { recursive: true });
}

console.log('Prepared Capacitor web bundle in www/.');
