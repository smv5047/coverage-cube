// Core data model + aggregation helpers for Coverage Cube.
//
// Dataset shape:
// {
//   risks:        [{ id, name, category, magnitude (1-10), description }]
//   tools:        [{ id, name, kind: 'tool' | 'process', vendor, description }]
//   environments: [{ id, name, providerLabel, accountLabel,
//                    providers: [{ id, name,
//                      accounts: [{ id, name, type: 'account' | 'management', owner, region, assets }] }] }]
//   coverage:     { "riskId|toolId|accountId": { coverage (0-100), assets, magnitude (1-10), notes } }
// }
//
// Coverage is always recorded at the leaf (account) level. Every higher level
// (provider, environment) is an asset-weighted roll-up of its leaves.

export const SCHEMA_VERSION = 1;

export const cellKey = (riskId, toolId, accountId) => `${riskId}|${toolId}|${accountId}`;

export function parseKey(key) {
  const [riskId, toolId, accountId] = key.split('|');
  return { riskId, toolId, accountId };
}

export function uid(prefix = 'id') {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function emptyDataset() {
  return { version: SCHEMA_VERSION, risks: [], tools: [], environments: [], coverage: {} };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------- hierarchy helpers ----------

export function allAccounts(data) {
  const out = [];
  for (const env of data.environments) {
    for (const prov of env.providers) {
      for (const acct of prov.accounts) out.push({ ...acct, env, provider: prov });
    }
  }
  return out;
}

export function accountIndex(data) {
  const map = new Map();
  for (const a of allAccounts(data)) map.set(a.id, a);
  return map;
}

export function leafIdsOfEnv(env) {
  return env.providers.flatMap((p) => p.accounts.map((a) => a.id));
}

export function leafIdsOfProvider(prov) {
  return prov.accounts.map((a) => a.id);
}

export const LEVELS = ['environment', 'provider', 'account'];

// Resolve the current drill path into concrete objects. Invalid ids (e.g. after
// an edit deleted the target) collapse back up to the deepest valid level.
export function resolveDrill(data, drill) {
  const env = drill.envId ? data.environments.find((e) => e.id === drill.envId) : null;
  const provider = env && drill.providerId ? env.providers.find((p) => p.id === drill.providerId) : null;
  return { env: env || null, provider: provider || null };
}

// The Z axis changes with drill depth: environments → providers → accounts.
export function buildZAxis(data, drill) {
  const { env, provider } = resolveDrill(data, drill);
  if (provider) {
    return {
      level: 'account',
      title: env.accountLabel || 'Account',
      items: provider.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        level: 'account',
        tag: a.type === 'management' ? 'MGMT' : null,
        leafIds: [a.id],
        ref: a,
      })),
    };
  }
  if (env) {
    return {
      level: 'provider',
      title: env.providerLabel || 'Provider',
      items: env.providers.map((p) => ({
        id: p.id,
        name: p.name,
        level: 'provider',
        leafIds: leafIdsOfProvider(p),
        ref: p,
      })),
    };
  }
  return {
    level: 'environment',
    title: 'Environment',
    items: data.environments.map((e) => ({
      id: e.id,
      name: e.name,
      level: 'environment',
      leafIds: leafIdsOfEnv(e),
      ref: e,
    })),
  };
}

// ---------- aggregation ----------

// Asset-weighted roll-up of a risk x tool across a set of leaf accounts.
// Returns null when the tool is not applied to the risk anywhere in the set.
export function aggregate(data, riskId, toolId, leafIds) {
  let assets = 0;
  let covWeighted = 0;
  let magWeighted = 0;
  let count = 0;
  let zeroCount = 0;
  let maxMag = 0;
  let wSum = 0;
  for (const leafId of leafIds) {
    const rec = data.coverage[cellKey(riskId, toolId, leafId)];
    if (!rec) continue;
    const a = Math.max(0, Number(rec.assets) || 0);
    const w = a > 0 ? a : 1; // never let a zero-asset record vanish from averages
    count += 1;
    assets += a;
    covWeighted += (Number(rec.coverage) || 0) * w;
    magWeighted += (Number(rec.magnitude) || 0) * w;
    maxMag = Math.max(maxMag, Number(rec.magnitude) || 0);
    if ((Number(rec.coverage) || 0) <= 0) zeroCount += 1;
    wSum += w;
  }
  if (!count) return null;
  return {
    coverage: covWeighted / wSum,
    assets,
    magnitude: magWeighted / wSum,
    maxMagnitude: maxMag,
    count,
    zeroCount,
  };
}

export function statusOf(coverage, threshold) {
  if (coverage == null) return 'unaddressed';
  if (coverage < 1) return 'none';
  if (coverage < threshold) return 'gap';
  return 'ok';
}

export const STATUS_LABEL = {
  ok: 'Covered',
  gap: 'Gap',
  none: 'No coverage',
  unaddressed: 'No control mapped',
};

// Best (max) coverage any single control provides for a risk on one account.
export function bestCoverageForLeaf(data, riskId, leafId) {
  let best = null;
  for (const t of data.tools) {
    const rec = data.coverage[cellKey(riskId, t.id, leafId)];
    if (rec) best = Math.max(best ?? 0, Number(rec.coverage) || 0);
  }
  return best;
}

// Build every renderable cell for the current drill scope.
export function buildCells(data, drill, threshold) {
  const z = buildZAxis(data, drill);
  const cells = [];
  const unaddressed = [];
  data.risks.forEach((risk, xi) => {
    z.items.forEach((zItem, zi) => {
      let any = false;
      data.tools.forEach((tool, yi) => {
        const agg = aggregate(data, risk.id, tool.id, zItem.leafIds);
        if (!agg) return;
        any = true;
        cells.push({
          key: `${risk.id}|${tool.id}|${zItem.id}`,
          xi,
          yi,
          zi,
          risk,
          tool,
          z: zItem,
          ...agg,
          status: statusOf(agg.coverage, threshold),
        });
      });
      if (!any && zItem.leafIds.length) {
        unaddressed.push({ key: `${risk.id}|∅|${zItem.id}`, xi, zi, risk, z: zItem });
      }
    });
  });
  return { z, cells, unaddressed };
}

export function summarize(cells, unaddressed) {
  let w = 0;
  let cov = 0;
  let assets = 0;
  const counts = { ok: 0, gap: 0, none: 0 };
  for (const c of cells) {
    const weight = c.assets > 0 ? c.assets : 1;
    w += weight;
    cov += c.coverage * weight;
    assets += c.assets;
    counts[c.status] += 1;
  }
  return {
    coverage: w ? cov / w : 0,
    assets,
    cells: cells.length,
    ...counts,
    unaddressed: unaddressed.length,
  };
}

// ---------- encoding ----------

// Red (0%) → yellow (50%) → green (100%).
export function coverageHue(coverage) {
  return (clamp(coverage, 0, 100) / 100) * 120;
}

export function coverageCss(coverage) {
  return `hsl(${coverageHue(coverage).toFixed(0)}, 80%, 50%)`;
}

export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '—';
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return Math.round(n).toLocaleString();
}

export const pct = (n) => (n == null ? '—' : `${Math.round(n)}%`);

// ---------- dataset hygiene ----------

// Drop coverage records whose risk/tool/account no longer exists.
export function pruneCoverage(data) {
  const risks = new Set(data.risks.map((r) => r.id));
  const tools = new Set(data.tools.map((t) => t.id));
  const accts = new Set(allAccounts(data).map((a) => a.id));
  const coverage = {};
  for (const [k, v] of Object.entries(data.coverage)) {
    const { riskId, toolId, accountId } = parseKey(k);
    if (risks.has(riskId) && tools.has(toolId) && accts.has(accountId)) coverage[k] = v;
  }
  return { ...data, coverage };
}

export function isValidDataset(d) {
  return (
    d &&
    Array.isArray(d.risks) &&
    Array.isArray(d.tools) &&
    Array.isArray(d.environments) &&
    d.environments.every((e) => Array.isArray(e.providers) && e.providers.every((p) => Array.isArray(p.accounts))) &&
    d.coverage &&
    typeof d.coverage === 'object'
  );
}
