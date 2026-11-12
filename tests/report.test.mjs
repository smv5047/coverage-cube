import test from 'node:test';
import assert from 'node:assert/strict';
import { briefToRows, briefToText, computeBrief, makeSnapshot } from '../src/data/report.js';
import { buildDemoDataset, buildOverviewDataset } from '../src/data/demo.js';
import { emptyDataset } from '../src/data/model.js';

for (const [name, build] of [
  ['overview', buildOverviewDataset],
  ['detailed', buildDemoDataset],
]) {
  test(`${name} summary is internally consistent`, () => {
    const data = build();
    const b = computeBrief(data, 60);
    assert.equal(b.pairs.length, data.risks.length * data.environments.length);
    const ok = b.pairs.filter((p) => p.status === 'ok').length;
    assert.equal(ok + b.belowTarget.length + b.unmapped.length, b.pairs.length);
    assert.equal(b.priorities.length, b.belowTarget.length + b.unmapped.length);
    for (let i = 1; i < b.priorities.length; i++) assert.ok(b.priorities[i - 1].exposure >= b.priorities[i].exposure);
    assert.ok(b.overall > 0 && b.overall <= 100);
    assert.ok(b.risksMeetingTarget <= data.risks.length);
    assert.ok(b.findings.length >= 3);
    assert.match(briefToText(b, 'T', 'today'), /Overall coverage: \d+%/);
    assert.ok(briefToRows(b).length > data.risks.length + data.tools.length);
    assert.equal(makeSnapshot(b).gaps, b.belowTarget.length);
  });
}

test('raising the target never reduces the gap count', () => {
  const data = buildOverviewDataset();
  assert.ok(computeBrief(data, 80).belowTarget.length >= computeBrief(data, 40).belowTarget.length);
});

test('unmapped risk counts as zero and is listed first-class', () => {
  const b = computeBrief(buildDemoDataset(), 60);
  const supply = b.riskEnv.find((r) => r.risk.name === 'Supply chain');
  assert.equal(supply.row.filter((c) => c.status === 'unaddressed').length, 3);
  assert.ok(supply.overall < 40);
  assert.ok(b.findings.some((f) => /No control is mapped for Supply chain/.test(f.text)));
});

test('empty dataset does not throw', () => {
  const b = computeBrief(emptyDataset(), 60);
  assert.equal(b.pairs.length, 0);
  assert.deepEqual(b.findings, []);
});
