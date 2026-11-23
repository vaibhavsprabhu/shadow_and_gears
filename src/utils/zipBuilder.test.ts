import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStandaloneWebpageEntries, buildStandaloneWebpageZip } from './standaloneExport';
import { crc32 } from './zipBuilder';

test('crc32 produces standard IEEE 802.3 checksum', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
});

import { CHARACTER_3D_SPECS } from '../game/characters3d';

test('standalone webpage entries contain all 5 files with updated names and 3D viewer', () => {
  const entries = buildStandaloneWebpageEntries();
  assert.equal(entries.length, 5);
  const paths = entries.map((e) => e.path);
  assert.ok(paths.includes('shadows-and-gears/index.html'));
  assert.ok(paths.includes('shadows-and-gears/style.css'));
  assert.ok(paths.includes('shadows-and-gears/game.js'));
  assert.ok(paths.includes('shadows-and-gears/characters.html'));
  assert.ok(paths.includes('shadows-and-gears/README.txt'));

  const combined = entries.map((e) => String(e.content)).join('\n');
  assert.ok(combined.includes('Roman'));
  assert.ok(combined.includes('Brock'));
  assert.ok(combined.includes('John'));
  assert.ok(combined.includes('Randy'));
  assert.ok(combined.includes('Shasha'));
  assert.ok(combined.includes('Shamus'));
  assert.ok(combined.includes('Officer Shamus'));
  assert.ok(combined.includes('Pablo'));
  assert.ok(!/\bWire\b/.test(combined));
  assert.ok(!/\bRitu\b/.test(combined));
  assert.ok(!/\bRathore\b/.test(combined));
  assert.ok(!/\bGhost\b/.test(combined));

  assert.equal(CHARACTER_3D_SPECS.length, 7);
  assert.deepEqual(
    CHARACTER_3D_SPECS.map((c) => c.id),
    ['roman', 'john', 'brock', 'randy', 'shasha', 'pablo', 'shamus']
  );
});

test('buildStandaloneWebpageZip outputs valid PKZIP binary header and EOCD', () => {
  const zip = buildStandaloneWebpageZip();
  assert.equal(zip[0], 0x50); // P
  assert.equal(zip[1], 0x4b); // K
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);
  // End of central directory signature 0x06054b50 near tail
  const tail = zip.length - 22;
  assert.equal(zip[tail], 0x50);
  assert.equal(zip[tail + 1], 0x4b);
  assert.equal(zip[tail + 2], 0x05);
  assert.equal(zip[tail + 3], 0x06);
});
