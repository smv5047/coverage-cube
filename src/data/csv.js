// Spreadsheet round-trip: one flat row per risk × tool × account.
// Export a template or the current data, edit it in Excel / Sheets, import it back.
import { allAccounts, cellKey, clamp, emptyDataset, envLabelsFor, uid } from './model.js';

export const COLUMNS = [
  { key: 'risk', header: 'Risk', aliases: ['risk name', 'threat'], help: 'Name of the risk, e.g. Ransomware.' },
  { key: 'category', header: 'Risk category', aliases: ['category'], help: 'Optional grouping, e.g. Identity.' },
  {
    key: 'tool',
    header: 'Tool / process',
    aliases: ['tool', 'control', 'tool or process', 'process', 'tool process'],
    help: 'The tool or process that addresses the risk, e.g. Wiz.',
  },
  {
    key: 'kind',
    header: 'Type (tool or process)',
    aliases: ['type', 'kind', 'control type'],
    help: '"tool" (default) or "process".',
  },
  { key: 'vendor', header: 'Vendor / owner', aliases: ['vendor'], help: 'Optional vendor or owning team.' },
  { key: 'environment', header: 'Environment', aliases: ['env'], help: 'e.g. Workstation, Citrix, Cloud.' },
  {
    key: 'provider',
    header: 'Provider / platform',
    aliases: ['provider', 'platform', 'csp', 'cloud service provider'],
    help: 'Optional second level, e.g. AWS. Leave blank to keep everything at environment level.',
  },
  {
    key: 'account',
    header: 'Account',
    aliases: ['account name', 'subscription', 'account subscription', 'device group'],
    help: 'Optional third level, e.g. prod-payments.',
  },
  {
    key: 'accountType',
    header: 'Account type',
    aliases: ['management account'],
    help: '"member" (default) or "management".',
  },
  { key: 'owner', header: 'Account owner', aliases: ['owner'], help: 'Optional team that owns the account.' },
  {
    key: 'coverage',
    header: 'Coverage %',
    aliases: ['coverage', 'coverage pct', 'coverage percent'],
    help: '0–100. Leave blank where the tool is not mapped to the risk. 0 means mapped but no coverage.',
  },
  {
    key: 'assets',
    header: 'Assets',
    aliases: ['asset volume', 'asset count', 'assets in scope'],
    help: 'Optional number of assets in scope. Defaults to 100.',
  },
  {
    key: 'magnitude',
    header: 'Risk magnitude (1-10)',
    aliases: ['risk magnitude', 'magnitude', 'risk score'],
    help: 'Optional, 1–10. Defaults to 5.',
  },
  { key: 'notes', header: 'Notes', aliases: ['note', 'comment', 'comments'], help: 'Optional free text.' },
];

export const REQUIRED_KEYS = ['risk', 'tool', 'environment', 'coverage'];

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const HEADER_LOOKUP = new Map();
for (const c of COLUMNS) {
  HEADER_LOOKUP.set(norm(c.header), c.key);
  HEADER_LOOKUP.set(norm(c.key), c.key);
  for (const a of c.aliases) HEADER_LOOKUP.set(norm(a), c.key);
}

// ---------- low-level delimited text ----------

export function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const counts = { ',': 0, '\t': 0, ';': 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// RFC 4180-style parser: quoted fields, escaped quotes, CRLF, embedded newlines.
export function parseDelimited(text, delimiter) {
  const src = String(text).replace(/^﻿/, '');
  const d = delimiter || detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"' && field === '') inQuotes = true;
    else if (ch === d) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

// Stop spreadsheet apps treating a text cell as a formula.
const guard = (v) => (typeof v === 'string' && /^[=+@]|^-(?!\d)/.test(v) ? `'${v}` : v);
const unguard = (v) => (/^'[=+@-]/.test(v) ? v.slice(1) : v);

export function toCsv(rows) {
  const cell = (v) => {
    const s = v == null ? '' : String(guard(v));
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// ---------- dataset → rows ----------

const HEADERS = COLUMNS.map((c) => c.header);

function rowFor(values) {
  return COLUMNS.map((c) => values[c.key] ?? '');
}

// includeBlank: also list every unmapped risk × tool × account combination with
// an empty coverage cell, as a fill-in sheet.
export function datasetToRows(data, { includeBlank = false } = {}) {
  const rows = [HEADERS];
  const usedRisks = new Set();
  const usedTools = new Set();
  const accounts = allAccounts(data);
  for (const a of accounts) {
    const scope = {
      environment: a.env.name,
      provider: a.provider.name,
      account: a.name,
      accountType: a.type === 'management' ? 'management' : 'member',
      owner: a.owner || '',
    };
    let any = false;
    for (const r of data.risks) {
      for (const t of data.tools) {
        const rec = data.coverage[cellKey(r.id, t.id, a.id)];
        if (!rec && !includeBlank) continue;
        any = true;
        usedRisks.add(r.id);
        usedTools.add(t.id);
        rows.push(
          rowFor({
            risk: r.name,
            category: r.category || '',
            tool: t.name,
            kind: t.kind === 'process' ? 'process' : 'tool',
            vendor: t.vendor || '',
            ...scope,
            coverage: rec ? rec.coverage : '',
            assets: rec ? rec.assets : a.assets || '',
            magnitude: rec ? rec.magnitude : (r.magnitude ?? ''),
            notes: rec?.notes || '',
          }),
        );
      }
    }
    if (!any) rows.push(rowFor({ ...scope, assets: a.assets || '' }));
  }
  // Risks and tools that have no coverage yet still need to survive a round trip.
  for (const r of data.risks) {
    if (!usedRisks.has(r.id))
      rows.push(rowFor({ risk: r.name, category: r.category || '', magnitude: r.magnitude ?? '' }));
  }
  for (const t of data.tools) {
    if (!usedTools.has(t.id)) {
      rows.push(rowFor({ tool: t.name, kind: t.kind === 'process' ? 'process' : 'tool', vendor: t.vendor || '' }));
    }
  }
  return rows;
}

export function datasetToCsv(data, opts) {
  return toCsv(datasetToRows(data, opts));
}

export function templateCsv() {
  const ex = (o) => rowFor(o);
  const aws = { environment: 'Cloud', provider: 'AWS', account: 'prod-payments', owner: 'Payments Eng' };
  return toCsv([
    HEADERS,
    ex({
      risk: 'Ransomware',
      category: 'Malware',
      tool: 'CrowdStrike',
      kind: 'tool',
      vendor: 'CrowdStrike',
      environment: 'Workstation',
      coverage: 92,
      assets: 9800,
      magnitude: 9,
    }),
    ex({
      risk: 'Ransomware',
      category: 'Malware',
      tool: 'CrowdStrike',
      kind: 'tool',
      vendor: 'CrowdStrike',
      ...aws,
      coverage: 58,
      assets: 2300,
      magnitude: 9,
      notes: 'Agents missing on container hosts',
    }),
    ex({
      risk: 'Misconfiguration',
      category: 'Configuration',
      tool: 'Wiz',
      kind: 'tool',
      vendor: 'Wiz',
      ...aws,
      coverage: 88,
      assets: 2300,
      magnitude: 7,
    }),
    ex({
      risk: 'Misconfiguration',
      category: 'Configuration',
      tool: 'Wiz',
      kind: 'tool',
      vendor: 'Wiz',
      environment: 'Cloud',
      provider: 'AWS',
      account: 'aws-org-management',
      accountType: 'management',
      owner: 'Cloud Platform',
      coverage: 95,
      assets: 140,
      magnitude: 9,
    }),
    ex({
      risk: 'Credential theft',
      category: 'Identity',
      tool: 'Access reviews',
      kind: 'process',
      vendor: 'IAM team',
      environment: 'Citrix',
      coverage: 45,
      assets: 2200,
      magnitude: 8,
    }),
    ex({
      risk: 'Data exfiltration',
      category: 'Data',
      tool: 'Purview DLP',
      kind: 'tool',
      vendor: 'Microsoft',
      environment: 'Citrix',
      coverage: 0,
      assets: 2200,
      magnitude: 8,
      notes: 'Not deployed yet',
    }),
  ]);
}

// ---------- rows → dataset ----------

function parseNumber(raw) {
  const s = String(raw ?? '')
    .replace(/[%\s,]/g, '')
    .trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

// Turn parsed rows into a dataset.
//   mode 'replace': start clean (keeping the report title and saved snapshots)
//   mode 'merge':   add to / update `base`, matching everything by name
// Returns { data, stats, warnings, error }.
export function importRows(rows, base = emptyDataset(), mode = 'replace') {
  const warnings = [];
  const fail = (error) => ({ data: null, stats: null, warnings, error });
  if (!rows.length) return fail('The file is empty.');

  const header = rows[0].map((h) => HEADER_LOOKUP.get(norm(h)) || null);
  const col = {};
  header.forEach((key, i) => {
    if (key && !(key in col)) col[key] = i;
  });
  const missing = REQUIRED_KEYS.filter((k) => !(k in col));
  if (missing.length) {
    const names = missing.map((k) => `“${COLUMNS.find((c) => c.key === k).header}”`).join(', ');
    return fail(`Missing column${missing.length > 1 ? 's' : ''}: ${names}. The first row must be the header row.`);
  }
  const ignored = rows[0].filter((h, i) => !header[i] && h.trim() !== '');
  if (ignored.length)
    warnings.push({ row: 1, msg: `Ignored unknown column${ignored.length > 1 ? 's' : ''}: ${ignored.join(', ')}` });

  const body = rows.slice(1);
  const get = (r, key) => (key in col ? unguard(String(r[col[key]] ?? '').trim()) : '');

  // Coverage written as 0–1 fractions (e.g. exported from a formula) → percent.
  const covNums = body.map((r) => parseNumber(get(r, 'coverage'))).filter((n) => n != null && !Number.isNaN(n));
  const anyPercentSign = body.some((r) => get(r, 'coverage').includes('%'));
  const fractions =
    !anyPercentSign && covNums.length > 0 && covNums.every((n) => n <= 1) && covNums.some((n) => !Number.isInteger(n));
  if (fractions)
    warnings.push({
      row: null,
      msg: 'Coverage values are all between 0 and 1, so they were read as fractions (0.75 → 75%).',
    });

  const data =
    mode === 'merge'
      ? structuredClone(base)
      : {
          ...emptyDataset(),
          meta: structuredClone(base.meta || { title: '' }),
          snapshots: structuredClone(base.snapshots || []),
        };
  data.meta ||= { title: '' };
  data.snapshots ||= [];

  const key = (s) => s.toLowerCase();
  const riskBy = new Map(data.risks.map((r) => [key(r.name), r]));
  const toolBy = new Map(data.tools.map((t) => [key(t.name), t]));
  const envBy = new Map(data.environments.map((e) => [key(e.name), e]));
  const stats = {
    rows: body.length,
    risks: 0,
    tools: 0,
    environments: 0,
    accounts: 0,
    records: 0,
    updated: 0,
    blank: 0,
    skipped: 0,
  };

  body.forEach((r, idx) => {
    const line = idx + 2;
    const riskName = get(r, 'risk');
    const toolName = get(r, 'tool');
    const envName = get(r, 'environment');
    if (!riskName && !toolName && !envName) {
      stats.skipped += 1;
      warnings.push({ row: line, msg: 'No risk, tool or environment — row skipped.' });
      return;
    }

    // A row with an unreadable coverage value is dropped whole, so a typo never
    // leaves half-imported risks or tools behind.
    const covText = get(r, 'coverage');
    let cov = parseNumber(covText);
    if (Number.isNaN(cov)) {
      stats.skipped += 1;
      warnings.push({ row: line, msg: `Coverage “${covText}” is not a number — row skipped.` });
      return;
    }

    const magRaw = parseNumber(get(r, 'magnitude'));
    const magnitude = magRaw == null || Number.isNaN(magRaw) ? null : clamp(magRaw, 1, 10);
    if (Number.isNaN(magRaw))
      warnings.push({ row: line, msg: `Risk magnitude “${get(r, 'magnitude')}” is not a number — used the default.` });

    let risk = null;
    if (riskName) {
      risk = riskBy.get(key(riskName));
      if (!risk) {
        risk = {
          id: uid('risk'),
          name: riskName,
          category: get(r, 'category'),
          magnitude: magnitude ?? 5,
          description: '',
        };
        data.risks.push(risk);
        riskBy.set(key(riskName), risk);
        stats.risks += 1;
      } else if (!risk.category && get(r, 'category')) risk.category = get(r, 'category');
    }

    let tool = null;
    if (toolName) {
      tool = toolBy.get(key(toolName));
      const kind = /^proc/i.test(get(r, 'kind')) ? 'process' : 'tool';
      if (!tool) {
        tool = {
          id: uid(kind === 'process' ? 'proc' : 'tool'),
          name: toolName,
          kind,
          vendor: get(r, 'vendor'),
          description: '',
        };
        data.tools.push(tool);
        toolBy.set(key(toolName), tool);
        stats.tools += 1;
      } else if (!tool.vendor && get(r, 'vendor')) tool.vendor = get(r, 'vendor');
    }

    const assetsRaw = parseNumber(get(r, 'assets'));
    if (Number.isNaN(assetsRaw))
      warnings.push({ row: line, msg: `Assets “${get(r, 'assets')}” is not a number — used the default.` });
    const assets = assetsRaw == null || Number.isNaN(assetsRaw) ? null : Math.max(0, Math.round(assetsRaw));

    let account = null;
    if (envName) {
      let env = envBy.get(key(envName));
      if (!env) {
        const [providerLabel, accountLabel] = envLabelsFor(envName);
        env = { id: uid('env'), name: envName, providerLabel, accountLabel, providers: [] };
        data.environments.push(env);
        envBy.set(key(envName), env);
        stats.environments += 1;
      }
      const provName = get(r, 'provider') || 'General';
      let prov = env.providers.find((p) => key(p.name) === key(provName));
      if (!prov) {
        prov = { id: uid('prov'), name: provName, accounts: [] };
        env.providers.push(prov);
      }
      const acctName = get(r, 'account') || (get(r, 'provider') ? `All ${provName}` : `All ${envName}`);
      account = prov.accounts.find((a) => key(a.name) === key(acctName));
      if (!account) {
        account = {
          id: uid('acct'),
          name: acctName,
          type: /^(mgmt|manage)/i.test(get(r, 'accountType')) ? 'management' : 'account',
          owner: get(r, 'owner'),
          region: '',
          assets: assets ?? 100,
        };
        prov.accounts.push(account);
        stats.accounts += 1;
      } else {
        if (assets != null && assets > (account.assets || 0)) account.assets = assets;
        if (!account.owner && get(r, 'owner')) account.owner = get(r, 'owner');
        if (/^(mgmt|manage)/i.test(get(r, 'accountType'))) account.type = 'management';
      }
    }

    if (cov == null) {
      if (risk && tool && account) stats.blank += 1;
      return;
    }
    if (!risk || !tool || !account) {
      stats.skipped += 1;
      warnings.push({ row: line, msg: 'Coverage needs a risk, a tool and an environment — value skipped.' });
      return;
    }
    if (fractions) cov *= 100;
    if (cov < 0 || cov > 100) warnings.push({ row: line, msg: `Coverage ${covText} is outside 0–100 — clamped.` });
    cov = Math.round(clamp(cov, 0, 100) * 10) / 10;

    const k = cellKey(risk.id, tool.id, account.id);
    const existing = data.coverage[k];
    if (existing) stats.updated += 1;
    else stats.records += 1;
    data.coverage[k] = {
      coverage: cov,
      assets: assets ?? existing?.assets ?? account.assets ?? 100,
      magnitude: magnitude ?? existing?.magnitude ?? risk.magnitude ?? 5,
      notes: get(r, 'notes') || existing?.notes || '',
    };
  });

  if (!data.risks.length && !data.tools.length && !data.environments.length)
    return fail('No usable rows were found below the header.');
  return { data, stats, warnings, error: null };
}

export function importCsvText(text, base, mode) {
  return importRows(parseDelimited(text), base, mode);
}
