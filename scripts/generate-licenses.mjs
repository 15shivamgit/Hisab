// Writes src/content/licenses.json: the app's direct runtime dependencies with their
// licence and licence text, for About → Open-source licences (SET-07).
// Run after adding or updating a dependency: npm run licenses
// (src/content/licenses.test.ts fails when the list is out of date.)

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const entries = Object.keys(pkg.dependencies)
  .sort()
  .map((name) => {
    const dir = join(root, 'node_modules', name);
    const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const file = existsSync(dir)
      ? readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f))
      : undefined;
    const raw = file ? readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n').trim() : '';
    // Licence files are hard-wrapped at ~80 columns; join each paragraph into one line so
    // the phone wraps it to the screen width.
    const text = raw
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
      .join('\n\n');
    const license = typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? '');
    return { name, version: meta.version, license, text };
  });

writeFileSync(
  join(root, 'src', 'content', 'licenses.json'),
  `${JSON.stringify(entries, null, 2)}\n`,
);
console.log(`licenses.json: ${entries.length} packages`);
for (const e of entries.filter((e) => !e.text)) console.log(`  no licence file: ${e.name}`);
