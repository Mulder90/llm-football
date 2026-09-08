import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { createPassingFixture } from '../src/fixtures/passing.ts';

it('keeps the simulation free of platform imports and external clocks', () => {
  const folder = resolve('src/sim');
  for (const file of readdirSync(folder).filter((file) => file.endsWith('.ts'))) {
    const source = readFileSync(resolve(folder, file), 'utf8');
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!);
    expect(
      imports.every((path) => path.startsWith('./')),
      `${file} imports another layer`,
    ).toBe(true);
    expect(source, `${file} reads a platform clock or hidden randomness`).not.toMatch(
      /Math\.random\(|Date\.now\(|performance\.now\(|setTimeout\(|setInterval\(|\bfetch\(|\bdocument\.|\bwindow\./,
    );
  }
});

it('protects the foundation fixture from unnoticed rule or numeric drift', () => {
  // Changes require reviewing the event sequence, engine version and slice record.
  // football-0.6 adds canonical handling history. Compared with the previous
  // ruleset: events and football state are unchanged in this passing fixture.
  expect(createPassingFixture().finalHash).toBe('cdc195ec');
});
