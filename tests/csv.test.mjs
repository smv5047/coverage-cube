import test from 'node:test';
import assert from 'node:assert/strict';
import { datasetToCsv, importCsvText, parseDelimited, templateCsv, toCsv } from '../src/data/csv.js';
import { buildDemoDataset, buildOverviewDataset } from '../src/data/demo.js';
import { allAccounts, cellKey, emptyDataset } from '../src/data/model.js';

// Coverage keyed by names, so two datasets with different ids can be compared.
function byName(data) {
  const out = {};
  for (const a of allAccounts(data)) {
    for (const r of data.risks) {
      for (const t of data.tools) {
        const rec = data.coverage[cellKey(r.id, t.id, a.id)];
        if (rec)
          out[`${r.name}|${t.name}|${a.env.name}|${a.provider.name}|${a.name}`] = [
            rec.coverage,
            rec.assets,
            rec.magnitude,
          ];
      }
    }
  }
  return out;
}

for (const [name, build] of [
  ['overview', buildOverviewDataset],
  ['detailed', buildDemoDataset],
]) {
  test(`${name} demo survives a CSV round trip`, () => {
    const original = build();
    const { data, error, warnings } = importCsvText(datasetToCsv(original));
    assert.equal(error, null);
    assert.deepEqual(warnings, []);
    assert.deepEqual(data.risks.map((r) => r.name).sort(), original.risks.map((r) => r.name).sort());
    assert.deepEqual(
      data.tools.map((t) => [t.name, t.kind]).sort(),
      original.tools.map((t) => [t.name, t.kind]).sort(),
    );
    assert.equal(allAccounts(data).length, allAccounts(original).length);
    assert.equal(
      allAccounts(data).filter((a) => a.type === 'management').length,
      allAccounts(original).filter((a) => a.type === 'management').length,
    );
    assert.deepEqual(byName(data), byName(original));
  });
}

test('fill-in sheet lists every combination and imports the same records', () => {
  const original = buildOverviewDataset();
  const csv = datasetToCsv(original, { includeBlank: true });
  const lines = parseDelimited(csv);
  assert.equal(lines.length - 1, original.risks.length * original.tools.length * allAccounts(original).length);
  const { data, stats } = importCsvText(csv);
  assert.deepEqual(byName(data), byName(original));
  assert.ok(stats.blank > 0);
});

test('template imports cleanly', () => {
  const { data, error, warnings, stats } = importCsvText(templateCsv());
  assert.equal(error, null);
  assert.deepEqual(warnings, []);
  assert.equal(stats.records, 6);
  assert.equal(data.environments.length, 3);
  assert.equal(data.tools.find((t) => t.name === 'Access reviews').kind, 'process');
  assert.equal(allAccounts(data).find((a) => a.name === 'aws-org-management').type, 'management');
  // Environment-only rows land on a default provider/account.
  assert.ok(allAccounts(data).some((a) => a.name === 'All Workstation' && a.provider.name === 'General'));
});

test('minimal high-level sheet: aliases, percent signs, semicolons, quoted commas', () => {
  const text =
    'Control;Risk;Env;Coverage\r\n"Wiz, Inc";MCP discovery;Cloud;72%\r\nOkta;Credential theft;Cloud;84 %\r\n';
  const { data, error } = importCsvText(text);
  assert.equal(error, null);
  assert.deepEqual(
    data.tools.map((t) => t.name),
    ['Wiz, Inc', 'Okta'],
  );
  assert.deepEqual(
    Object.values(data.coverage).map((c) => c.coverage),
    [72, 84],
  );
});

test('fractions are read as percentages', () => {
  const { data, warnings } = importCsvText('Risk,Tool,Environment,Coverage\nA,T,Cloud,0.75\nB,T,Cloud,1\n');
  assert.deepEqual(
    Object.values(data.coverage).map((c) => c.coverage),
    [75, 100],
  );
  assert.equal(warnings.length, 1);
});

test('problems are reported, not swallowed', () => {
  assert.match(importCsvText('Risk,Tool,Coverage\nA,T,5\n').error, /Environment/);
  assert.match(importCsvText('').error, /empty/);
  const { data, warnings, stats } = importCsvText(
    'Risk,Tool,Environment,Coverage,Bogus\nTypo,T2,Cloud,abc,x\nA,T,Cloud,140,x\n,,,50,x\nA,,Cloud,50,x\n',
  );
  assert.equal(Object.values(data.coverage)[0].coverage, 100);
  assert.equal(stats.skipped, 3);
  assert.equal(warnings.length, 5);
  assert.deepEqual(
    data.risks.map((r) => r.name),
    ['A'],
  );
});

test('merge updates by name and keeps everything else; replace keeps title and snapshots', () => {
  const base = buildOverviewDataset();
  base.meta = { title: 'Q4 review' };
  base.snapshots = [{ id: 's1', date: '2026-09-30', coverage: 50 }];
  const before = byName(base);
  const merged = importCsvText(
    'Risk,Tool,Environment,Provider,Account,Coverage\nmcp DISCOVERY,wiz,cloud,aws,prod-workloads,99\nNew risk,Wiz,Cloud,AWS,prod-workloads,10\n',
    base,
    'merge',
  );
  assert.equal(merged.stats.updated, 1);
  assert.equal(merged.stats.records, 1);
  assert.equal(merged.stats.risks, 1);
  const after = byName(merged.data);
  assert.equal(after['MCP discovery|Wiz|Cloud|AWS|prod-workloads'][0], 99);
  assert.equal(Object.keys(after).length, Object.keys(before).length + 1);
  assert.equal(
    base.coverage[Object.keys(base.coverage)[0]].coverage,
    buildOverviewDataset().coverage[Object.keys(base.coverage)[0]].coverage,
  );

  const replaced = importCsvText('Risk,Tool,Environment,Coverage\nA,T,Cloud,5\n', base, 'replace');
  assert.equal(replaced.data.risks.length, 1);
  assert.equal(replaced.data.meta.title, 'Q4 review');
  assert.equal(replaced.data.snapshots.length, 1);
});

test('formula-like text is neutralised on export and restored on import', () => {
  const csv = toCsv([
    ['Risk', 'Tool', 'Environment', 'Coverage'],
    ['=SUM(A1)', '-dash', 'Cloud', -5],
  ]);
  assert.match(csv, /'=SUM\(A1\),'-dash,Cloud,-5/);
  const { data } = importCsvText(csv, emptyDataset());
  assert.equal(data.risks[0].name, '=SUM(A1)');
  assert.equal(data.tools[0].name, '-dash');
});
