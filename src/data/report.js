// Leadership summary: environment-level roll-ups, plain-language findings,
// prioritized gaps and snapshots for tracking coverage over time.
import {
  accountIndex,
  aggregate,
  bestCoverageForLeaf,
  buildCells,
  cellKey,
  formatNumber,
  leafIdsOfEnv,
  STATUS_LABEL,
  statusOf,
  uid,
} from './model.js';

const round = (n) => Math.round(n);
const list = (names) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

// Asset-weighted "best single control" coverage of a risk over a set of accounts.
// Accounts where nothing is mapped count as 0%, so blind spots pull the figure down.
function bestCoverage(data, accounts, riskId, leafIds) {
  let w = 0;
  let sum = 0;
  for (const id of leafIds) {
    const a = accounts.get(id)?.assets || 1;
    sum += (bestCoverageForLeaf(data, riskId, id) ?? 0) * a;
    w += a;
  }
  return w ? sum / w : null;
}

export function computeBrief(data, threshold) {
  const accounts = accountIndex(data);
  const envs = data.environments
    .map((e) => {
      const leafIds = leafIdsOfEnv(e);
      return {
        id: e.id,
        name: e.name,
        leafIds,
        assets: leafIds.reduce((s, id) => s + (accounts.get(id)?.assets || 0), 0),
      };
    })
    .filter((e) => e.leafIds.length);
  const allLeaves = envs.flatMap((e) => e.leafIds);
  const { cells } = buildCells(data, { envId: null, providerId: null }, threshold);
  const zeroControls = cells.filter((c) => c.status === 'none');

  // Risk × environment: how well the strongest control covers each risk.
  const riskEnv = data.risks.map((risk) => {
    const row = envs.map((env) => {
      const controls = data.tools
        .map((t) => ({ tool: t, agg: aggregate(data, risk.id, t.id, env.leafIds) }))
        .filter((c) => c.agg)
        .sort((a, b) => b.agg.coverage - a.agg.coverage);
      if (!controls.length)
        return { risk, env, value: null, status: 'unaddressed', controls: 0, bestTool: null, notes: '' };
      const value = bestCoverage(data, accounts, risk.id, env.leafIds);
      const notes = new Set();
      for (const id of env.leafIds) {
        for (const c of controls) {
          const n = data.coverage[cellKey(risk.id, c.tool.id, id)]?.notes;
          if (n) notes.add(n);
        }
      }
      return {
        risk,
        env,
        value,
        status: statusOf(value, threshold),
        controls: controls.length,
        bestTool: controls[0].tool,
        notes: [...notes].slice(0, 2).join(' · '),
      };
    });
    const overall = bestCoverage(data, accounts, risk.id, allLeaves);
    return { risk, row, overall, status: statusOf(overall, threshold) };
  });

  // Tool × environment: how well each tool is deployed against its mapped risks.
  const toolEnv = data.tools.map((tool) => {
    const roll = (leafIds) => {
      let w = 0;
      let sum = 0;
      for (const id of leafIds) {
        for (const r of data.risks) {
          const rec = data.coverage[cellKey(r.id, tool.id, id)];
          if (!rec) continue;
          const a = Number(rec.assets) > 0 ? Number(rec.assets) : 1;
          sum += (Number(rec.coverage) || 0) * a;
          w += a;
        }
      }
      return w ? sum / w : null;
    };
    const row = envs.map((env) => {
      const value = roll(env.leafIds);
      return { env, value, status: value == null ? 'na' : statusOf(value, threshold) };
    });
    const overall = roll(allLeaves);
    return { tool, row, overall, status: overall == null ? 'na' : statusOf(overall, threshold) };
  });

  const envOverall = envs.map((env, i) => {
    const vals = riskEnv.map((r) => r.row[i].value ?? 0);
    const value = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
    return { env, value, status: value == null ? 'na' : statusOf(value, threshold) };
  });

  const pairs = riskEnv.flatMap((r) => r.row);
  const overall = riskEnv.length ? riskEnv.reduce((s, r) => s + (r.overall ?? 0), 0) / riskEnv.length : 0;
  const risksMeetingTarget = riskEnv.filter((r) => r.row.length && r.row.every((c) => c.status === 'ok')).length;
  const unmapped = pairs.filter((p) => p.status === 'unaddressed');
  const belowTarget = pairs.filter((p) => p.status === 'gap' || p.status === 'none');
  const singleControl = pairs.filter((p) => p.controls === 1);

  // Every risk/environment pair that misses the target, worst exposure first.
  const priorities = pairs
    .filter((p) => p.status !== 'ok')
    .map((p) => ({
      ...p,
      key: `${p.risk.id}|${p.env.id}`,
      coverage: p.value ?? 0,
      assets: p.env.assets,
      exposure: (Number(p.risk.magnitude) || 5) * p.env.assets * (1 - (p.value ?? 0) / 100),
    }))
    .sort((a, b) => b.exposure - a.exposure);

  const brief = {
    threshold,
    envs,
    overall,
    pairs,
    riskEnv,
    toolEnv,
    envOverall,
    risksMeetingTarget,
    unmapped,
    belowTarget,
    singleControl,
    zeroControls,
    priorities,
    counts: {
      risks: data.risks.length,
      tools: data.tools.length,
      environments: envs.length,
      accounts: allLeaves.length,
    },
  };
  brief.findings = buildFindings(brief);
  return brief;
}

function buildFindings(b) {
  const out = [];
  const { threshold } = b;
  if (!b.pairs.length) return out;

  out.push({
    tone: b.overall >= threshold ? 'good' : 'warn',
    text: `Overall coverage is ${round(b.overall)}% against a ${threshold}% target. ${b.risksMeetingTarget} of ${b.counts.risks} risks meet the target in every environment.`,
  });

  const ranked = b.envOverall.filter((e) => e.value != null).sort((a, c) => a.value - c.value);
  if (ranked.length > 1) {
    const weak = ranked[0];
    const strong = ranked[ranked.length - 1];
    out.push({
      tone: weak.value < threshold ? 'bad' : 'good',
      text: `${weak.env.name} is the weakest environment at ${round(weak.value)}%; ${strong.env.name} is the strongest at ${round(strong.value)}%.`,
    });
  }

  const risks = b.riskEnv.filter((r) => r.overall != null).sort((a, c) => a.overall - c.overall);
  if (risks.length > 1) {
    const weak = risks[0];
    const weakEnvs = weak.row.filter((c) => c.status !== 'ok').map((c) => c.env.name);
    out.push({
      tone: weak.overall < threshold ? 'bad' : 'good',
      text: `${weak.risk.name} is the least-covered risk at ${round(weak.overall)}%${weakEnvs.length ? `, below target in ${list(weakEnvs)}` : ''}.`,
    });
  }

  if (b.unmapped.length) {
    const byRisk = new Map();
    for (const u of b.unmapped) byRisk.set(u.risk.name, [...(byRisk.get(u.risk.name) || []), u.env.name]);
    const parts = [...byRisk.entries()].slice(0, 3).map(([risk, envNames]) => `${risk} in ${list(envNames)}`);
    const more = byRisk.size - 3;
    out.push({
      tone: 'bad',
      text: `No control is mapped for ${parts.join('; ')}${more > 0 ? `; and ${more} more risk${more > 1 ? 's' : ''}` : ''}.`,
    });
  }

  if (b.zeroControls.length) {
    const n = b.zeroControls.length;
    const zero = b.zeroControls.slice(0, 3).map((p) => `${p.tool.name} for ${p.risk.name} in ${p.z.name}`);
    out.push({
      tone: 'bad',
      text: `${n} mapped control${n > 1 ? 's provide' : ' provides'} no coverage yet: ${zero.join('; ')}${n > 3 ? '; …' : ''}.`,
    });
  }

  const top = b.priorities[0];
  if (top) {
    out.push({
      tone: 'warn',
      text:
        top.value == null
          ? `Largest exposure: ${top.risk.name} in ${top.env.name}, with no control across ${formatNumber(top.assets)} assets.`
          : `Largest exposure: ${top.risk.name} in ${top.env.name}, at ${round(top.value)}% across ${formatNumber(top.assets)} assets (strongest control: ${top.bestTool.name}).`,
    });
  }

  if (b.singleControl.length) {
    const n = b.singleControl.length;
    out.push({
      tone: 'info',
      text: `${n} risk/environment pair${n > 1 ? 's rely' : ' relies'} on a single control, with no second layer if it fails.`,
    });
  }
  return out;
}

// ---------- tracking over time ----------

export function makeSnapshot(brief, label = '') {
  return {
    id: uid('snap'),
    date: new Date().toISOString().slice(0, 10),
    label,
    coverage: Math.round(brief.overall * 10) / 10,
    gaps: brief.belowTarget.length,
    unmapped: brief.unmapped.length,
    singleControl: brief.singleControl.length,
    risksMeetingTarget: brief.risksMeetingTarget,
    risks: brief.counts.risks,
    threshold: brief.threshold,
    byEnv: Object.fromEntries(brief.envOverall.map((e) => [e.env.name, e.value == null ? null : round(e.value)])),
  };
}

// Illustrative history for demo mode, ending just below today's figures.
export function sampleHistory(brief) {
  const steps = [
    { back: 12, d: -14, gaps: 5, unmapped: 2, risks: 2 },
    { back: 9, d: -9, gaps: 4, unmapped: 1, risks: 1 },
    { back: 6, d: -6, gaps: 2, unmapped: 1, risks: 1 },
    { back: 3, d: -2, gaps: 1, unmapped: 0, risks: 0 },
  ];
  const now = new Date();
  return steps.map((s, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - s.back, 1);
    return {
      id: `sample-${i}`,
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`,
      label: 'Sample',
      coverage: Math.max(0, Math.round((brief.overall + s.d) * 10) / 10),
      gaps: brief.belowTarget.length + s.gaps,
      unmapped: brief.unmapped.length + s.unmapped,
      singleControl: brief.singleControl.length + (i < 2 ? 1 : 0),
      risksMeetingTarget: Math.max(0, brief.risksMeetingTarget - s.risks),
      risks: brief.counts.risks,
      threshold: brief.threshold,
      byEnv: {},
    };
  });
}

// ---------- text / CSV exports of the summary ----------

const prioLine = (p) =>
  p.value == null
    ? `${p.risk.name} in ${p.env.name}: no control mapped, ${formatNumber(p.assets)} assets`
    : `${p.risk.name} in ${p.env.name}: ${round(p.value)}% (strongest control ${p.bestTool.name}), ${formatNumber(p.assets)} assets`;

export function briefToText(brief, title, asOf) {
  const lines = [`${title} — as of ${asOf}`, ''];
  lines.push(
    `Overall coverage: ${round(brief.overall)}% (target ${brief.threshold}%)`,
    `Risks meeting target in every environment: ${brief.risksMeetingTarget} of ${brief.counts.risks}`,
    `Risk/environment pairs below target: ${brief.belowTarget.length} of ${brief.pairs.length} · No control mapped: ${brief.unmapped.length} · Single control: ${brief.singleControl.length}`,
    '',
    'Key findings',
    ...brief.findings.map((f) => `- ${f.text}`),
  );
  if (brief.priorities.length) {
    lines.push('', 'Top priorities');
    brief.priorities.slice(0, 10).forEach((p, i) => lines.push(`${i + 1}. ${prioLine(p)}`));
  }
  return lines.join('\n');
}

export function briefToRows(brief) {
  const pctOrBlank = (v) => (v == null ? '' : round(v));
  const rows = [
    ['Risk coverage by environment (strongest control, %)'],
    ['Risk', ...brief.envs.map((e) => e.name), 'Overall'],
  ];
  for (const r of brief.riskEnv) {
    rows.push([
      r.risk.name,
      ...r.row.map((c) => (c.value == null ? 'No control' : round(c.value))),
      pctOrBlank(r.overall),
    ]);
  }
  rows.push(
    [],
    ['Tool / process coverage by environment (%)'],
    ['Tool / process', ...brief.envs.map((e) => e.name), 'Overall'],
  );
  for (const t of brief.toolEnv)
    rows.push([t.tool.name, ...t.row.map((c) => pctOrBlank(c.value)), pctOrBlank(t.overall)]);
  rows.push(
    [],
    ['Priorities'],
    ['Rank', 'Risk', 'Environment', 'Coverage %', 'Strongest control', 'Controls mapped', 'Assets', 'Status', 'Notes'],
  );
  brief.priorities.forEach((p, i) =>
    rows.push([
      i + 1,
      p.risk.name,
      p.env.name,
      p.value == null ? '' : round(p.value),
      p.bestTool?.name || 'None',
      p.controls,
      p.assets,
      STATUS_LABEL[p.status],
      p.notes,
    ]),
  );
  return rows;
}
