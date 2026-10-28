import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import licenses from '@/content/licenses.json';

const root = join(__dirname, '..', '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  dependencies: Record<string, string>;
};

test('licenses.json lists every runtime dependency at its installed version (npm run licenses)', () => {
  expect(licenses.map((l) => l.name)).toEqual(Object.keys(pkg.dependencies).sort());
  for (const entry of licenses) {
    const installed = JSON.parse(
      readFileSync(join(root, 'node_modules', entry.name, 'package.json'), 'utf8'),
    ) as { version: string };
    expect(`${entry.name}@${entry.version}`).toBe(`${entry.name}@${installed.version}`);
    expect(entry.license).not.toBe('');
  }
});
