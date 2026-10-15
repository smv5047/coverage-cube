// Realistic, deterministic dummy data for demo mode.
import { cellKey, clamp, SCHEMA_VERSION } from './model.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const risks = [
  {
    id: 'r-ransom',
    name: 'Ransomware',
    category: 'Malware',
    magnitude: 9,
    description: 'Encryption/extortion of endpoints and servers.',
  },
  {
    id: 'r-phish',
    name: 'Credential phishing',
    category: 'Identity',
    magnitude: 8,
    description: 'Theft of user credentials and MFA fatigue attacks.',
  },
  {
    id: 'r-privesc',
    name: 'Privilege escalation',
    category: 'Identity',
    magnitude: 7,
    description: 'Abuse of excessive or standing privileged access.',
  },
  {
    id: 'r-exfil',
    name: 'Data exfiltration',
    category: 'Data',
    magnitude: 8,
    description: 'Unauthorized movement of sensitive data out of the org.',
  },
  {
    id: 'r-vuln',
    name: 'Unpatched vulns',
    category: 'Vulnerability',
    magnitude: 7,
    description: 'Exploitable, known vulnerabilities left unremediated.',
  },
  {
    id: 'r-misconfig',
    name: 'Misconfiguration',
    category: 'Configuration',
    magnitude: 7,
    description: 'Insecure settings, public exposure, drift from baseline.',
  },
  {
    id: 'r-lateral',
    name: 'Lateral movement',
    category: 'Network',
    magnitude: 7,
    description: 'Attacker pivoting between hosts and trust boundaries.',
  },
  {
    id: 'r-insider',
    name: 'Insider misuse',
    category: 'Data',
    magnitude: 6,
    description: 'Malicious or negligent misuse by trusted users.',
  },
  {
    id: 'r-supply',
    name: 'Supply chain',
    category: 'Third-party',
    magnitude: 6,
    description: 'Compromised software, images, or vendor access.',
  },
  {
    id: 'r-session',
    name: 'Session hijacking',
    category: 'Identity',
    magnitude: 6,
    description: 'Token/cookie theft and session replay.',
  },
];

const tools = [
  {
    id: 't-edr',
    name: 'EDR',
    kind: 'tool',
    vendor: 'CrowdStrike Falcon',
    description: 'Endpoint detection & response.',
  },
  {
    id: 't-siem',
    name: 'SIEM',
    kind: 'tool',
    vendor: 'Splunk ES',
    description: 'Centralized logging, correlation and alerting.',
  },
  {
    id: 't-cspm',
    name: 'CSPM / CNAPP',
    kind: 'tool',
    vendor: 'Wiz',
    description: 'Cloud posture and workload scanning.',
  },
  {
    id: 't-pam',
    name: 'PAM',
    kind: 'tool',
    vendor: 'CyberArk',
    description: 'Privileged access vaulting and session brokering.',
  },
  { id: 't-dlp', name: 'DLP', kind: 'tool', vendor: 'Microsoft Purview', description: 'Data loss prevention.' },
  {
    id: 't-vm',
    name: 'Vuln scanning',
    kind: 'tool',
    vendor: 'Tenable',
    description: 'Authenticated vulnerability scanning.',
  },
  {
    id: 't-idp',
    name: 'SSO + MFA',
    kind: 'tool',
    vendor: 'Okta',
    description: 'Identity provider with phishing-resistant MFA.',
  },
  {
    id: 'p-patch',
    name: 'Patch mgmt',
    kind: 'process',
    vendor: 'IT Ops',
    description: 'Monthly patch cycle with emergency SLA.',
  },
  {
    id: 'p-access',
    name: 'Access reviews',
    kind: 'process',
    vendor: 'IAM team',
    description: 'Quarterly user and privileged access recertification.',
  },
  {
    id: 'p-ir',
    name: 'IR runbooks',
    kind: 'process',
    vendor: 'SOC',
    description: 'Documented & exercised incident response playbooks.',
  },
  {
    id: 'p-sat',
    name: 'Awareness training',
    kind: 'process',
    vendor: 'GRC',
    description: 'Security awareness and phishing simulation.',
  },
];

const environments = [
  {
    id: 'e-ws',
    name: 'Workstation',
    providerLabel: 'Platform',
    accountLabel: 'Device group',
    providers: [
      {
        id: 'p-win',
        name: 'Windows (Intune)',
        accounts: [
          {
            id: 'a-win-na',
            name: 'Corp laptops – NA',
            type: 'account',
            owner: 'EUC – Americas',
            region: 'NA',
            assets: 6200,
          },
          {
            id: 'a-win-emea',
            name: 'Corp laptops – EMEA',
            type: 'account',
            owner: 'EUC – EMEA',
            region: 'EMEA',
            assets: 3900,
          },
          {
            id: 'a-win-eng',
            name: 'Engineering workstations',
            type: 'account',
            owner: 'Platform Eng',
            region: 'Global',
            assets: 1150,
          },
          { id: 'a-win-kiosk', name: 'Retail kiosks', type: 'account', owner: 'Store Ops', region: 'NA', assets: 840 },
        ],
      },
      {
        id: 'p-mac',
        name: 'macOS (Jamf)',
        accounts: [
          {
            id: 'a-mac-design',
            name: 'Design & marketing',
            type: 'account',
            owner: 'EUC – Mac',
            region: 'Global',
            assets: 720,
          },
          {
            id: 'a-mac-exec',
            name: 'Executive Macs',
            type: 'account',
            owner: 'Exec Support',
            region: 'Global',
            assets: 64,
          },
        ],
      },
    ],
  },
  {
    id: 'e-citrix',
    name: 'Citrix',
    providerLabel: 'Delivery platform',
    accountLabel: 'Delivery group',
    providers: [
      {
        id: 'p-daas',
        name: 'Citrix DaaS (cloud)',
        accounts: [
          { id: 'a-ctx-cc', name: 'Contact center pool', type: 'account', owner: 'CX Ops', region: 'NA', assets: 1800 },
          {
            id: 'a-ctx-3p',
            name: 'Third-party contractors',
            type: 'account',
            owner: 'Vendor Mgmt',
            region: 'Global',
            assets: 650,
          },
        ],
      },
      {
        id: 'p-cvad',
        name: 'On-prem CVAD',
        accounts: [
          {
            id: 'a-ctx-fin',
            name: 'Finance published apps',
            type: 'account',
            owner: 'Finance IT',
            region: 'NA',
            assets: 420,
          },
          {
            id: 'a-ctx-erp',
            name: 'Legacy ERP delivery group',
            type: 'account',
            owner: 'ERP Team',
            region: 'EMEA',
            assets: 310,
          },
        ],
      },
    ],
  },
  {
    id: 'e-cloud',
    name: 'Cloud',
    providerLabel: 'Cloud service provider',
    accountLabel: 'Account / subscription',
    providers: [
      {
        id: 'p-aws',
        name: 'AWS',
        accounts: [
          {
            id: 'a-aws-mgmt',
            name: 'aws-org-management',
            type: 'management',
            owner: 'Cloud Platform',
            region: 'us-east-1',
            assets: 140,
          },
          {
            id: 'a-aws-pay',
            name: 'prod-payments',
            type: 'account',
            owner: 'Payments Eng',
            region: 'us-east-1',
            assets: 2300,
          },
          {
            id: 'a-aws-lake',
            name: 'prod-data-lake',
            type: 'account',
            owner: 'Data Platform',
            region: 'us-west-2',
            assets: 1650,
          },
          {
            id: 'a-aws-sec',
            name: 'security-tooling',
            type: 'account',
            owner: 'SecEng',
            region: 'us-east-1',
            assets: 380,
          },
          {
            id: 'a-aws-dev',
            name: 'dev-sandbox',
            type: 'account',
            owner: 'Engineering',
            region: 'us-west-2',
            assets: 2900,
          },
        ],
      },
      {
        id: 'p-azure',
        name: 'Azure',
        accounts: [
          {
            id: 'a-az-root',
            name: 'Tenant Root Group',
            type: 'management',
            owner: 'Cloud Platform',
            region: 'global',
            assets: 90,
          },
          { id: 'a-az-crm', name: 'sub-prod-crm', type: 'account', owner: 'CRM Team', region: 'eastus', assets: 980 },
          {
            id: 'a-az-ana',
            name: 'sub-dev-analytics',
            type: 'account',
            owner: 'Analytics',
            region: 'westeurope',
            assets: 760,
          },
        ],
      },
      {
        id: 'p-gcp',
        name: 'GCP',
        accounts: [
          {
            id: 'a-gcp-org',
            name: 'org-admin',
            type: 'management',
            owner: 'Cloud Platform',
            region: 'global',
            assets: 45,
          },
          {
            id: 'a-gcp-ml',
            name: 'proj-ml-platform',
            type: 'account',
            owner: 'ML Eng',
            region: 'us-central1',
            assets: 1240,
          },
        ],
      },
    ],
  },
  {
    id: 'e-dc',
    name: 'Data center',
    providerLabel: 'Site / platform',
    accountLabel: 'Cluster',
    providers: [
      {
        id: 'p-vsphere',
        name: 'VMware vSphere',
        accounts: [
          {
            id: 'a-dc1',
            name: 'DC1 production cluster',
            type: 'account',
            owner: 'Infra Ops',
            region: 'Ashburn',
            assets: 1450,
          },
          { id: 'a-dc2', name: 'DC2 DR cluster', type: 'account', owner: 'Infra Ops', region: 'Dallas', assets: 610 },
        ],
      },
      {
        id: 'p-ot',
        name: 'Plant OT network',
        accounts: [
          {
            id: 'a-ot',
            name: 'Manufacturing line HMIs',
            type: 'account',
            owner: 'Plant Eng',
            region: 'Ohio',
            assets: 230,
          },
        ],
      },
    ],
  },
];

// How strongly a control addresses each risk (0 = not mapped).
const relevance = {
  't-edr': { 'r-ransom': 1, 'r-lateral': 0.85, 'r-privesc': 0.7, 'r-session': 0.5, 'r-exfil': 0.3 },
  't-siem': {
    'r-ransom': 0.6,
    'r-lateral': 0.8,
    'r-privesc': 0.6,
    'r-exfil': 0.6,
    'r-insider': 0.7,
    'r-phish': 0.5,
    'r-session': 0.6,
  },
  't-cspm': { 'r-misconfig': 1, 'r-vuln': 0.85, 'r-supply': 0.6, 'r-privesc': 0.6, 'r-exfil': 0.4 },
  't-pam': { 'r-privesc': 1, 'r-lateral': 0.6, 'r-insider': 0.6 },
  't-dlp': { 'r-exfil': 1, 'r-insider': 0.85 },
  't-vm': { 'r-vuln': 1, 'r-misconfig': 0.6 },
  't-idp': { 'r-phish': 1, 'r-session': 0.8, 'r-privesc': 0.4 },
  'p-patch': { 'r-vuln': 1, 'r-ransom': 0.5 },
  'p-access': { 'r-privesc': 0.8, 'r-insider': 0.6 },
  'p-ir': { 'r-ransom': 0.7, 'r-exfil': 0.5, 'r-lateral': 0.4 },
  'p-sat': { 'r-phish': 0.9, 'r-insider': 0.4 },
};

// Deployment maturity of a control per environment (0 = not applicable there).
const maturity = {
  't-edr': { 'e-ws': 0.95, 'e-citrix': 0.75, 'e-cloud': 0.55, 'e-dc': 0.8 },
  't-siem': { 'e-ws': 0.85, 'e-citrix': 0.6, 'e-cloud': 0.75, 'e-dc': 0.7 },
  't-cspm': { 'e-cloud': 0.9 },
  't-pam': { 'e-citrix': 0.5, 'e-cloud': 0.65, 'e-dc': 0.85 },
  't-dlp': { 'e-ws': 0.7, 'e-citrix': 0.35, 'e-cloud': 0.4 },
  't-vm': { 'e-ws': 0.8, 'e-citrix': 0.55, 'e-cloud': 0.6, 'e-dc': 0.85 },
  't-idp': { 'e-ws': 0.95, 'e-citrix': 0.7, 'e-cloud': 0.85 },
  'p-patch': { 'e-ws': 0.9, 'e-citrix': 0.6, 'e-dc': 0.55 },
  'p-access': { 'e-ws': 0.6, 'e-citrix': 0.45, 'e-cloud': 0.7, 'e-dc': 0.5 },
  'p-ir': { 'e-ws': 0.8, 'e-citrix': 0.5, 'e-cloud': 0.6, 'e-dc': 0.65 },
  'p-sat': { 'e-ws': 0.85, 'e-citrix': 0.65 },
};

// Account-level quirks that make the picture realistic.
const accountModifiers = {
  'a-aws-dev': { all: 0.55, 't-edr': 0 }, // sandbox: no EDR agents, weak everything
  'a-az-ana': { all: 0.7 },
  'a-win-kiosk': { 't-dlp': 0, 'p-sat': 0, 't-idp': 0.4 },
  'a-mac-exec': { 't-dlp': 0.3 },
  'a-ctx-3p': { all: 0.65, 't-dlp': 0 }, // contractors on unmanaged endpoints
  'a-ctx-erp': { 'p-patch': 0.2, 't-vm': 0.4 },
  'a-ot': { all: 0.4, 't-edr': 0, 'p-patch': 0.1, 't-idp': 0 },
  'a-aws-mgmt': { 't-pam': 1.3, 'p-access': 1.3 },
  'a-gcp-org': { 't-pam': 0 }, // management project without break-glass vaulting
  'a-dc2': { 't-siem': 0.5 },
};

// Risk magnitude bias per account (crown-jewel vs. sandbox).
const magnitudeBias = {
  'a-aws-pay': 2,
  'a-aws-lake': 1.5,
  'a-aws-mgmt': 2,
  'a-az-root': 2,
  'a-gcp-org': 2,
  'a-az-crm': 1,
  'a-aws-dev': -2,
  'a-az-ana': -1,
  'a-mac-exec': 1.5,
  'a-ctx-fin': 1.5,
  'a-ot': 1.5,
  'a-win-kiosk': -1,
};

// Share of an account's assets exposed to each risk.
const exposure = {
  'r-ransom': 0.95,
  'r-phish': 0.7,
  'r-privesc': 0.35,
  'r-exfil': 0.5,
  'r-vuln': 1,
  'r-misconfig': 0.8,
  'r-lateral': 0.6,
  'r-insider': 0.4,
  'r-supply': 0.3,
  'r-session': 0.55,
};

export function buildDemoDataset() {
  const rand = mulberry32(20261014);
  const coverage = {};
  for (const env of environments) {
    for (const prov of env.providers) {
      for (const acct of prov.accounts) {
        const mods = accountModifiers[acct.id] || {};
        for (const tool of tools) {
          const m = maturity[tool.id]?.[env.id];
          if (!m) continue;
          for (const risk of risks) {
            const rel = relevance[tool.id]?.[risk.id];
            if (!rel) continue;
            const mod = (mods[tool.id] ?? 1) * (mods.all ?? 1);
            const noise = 0.62 + rand() * 0.6;
            const cov = mod === 0 ? 0 : Math.round(clamp(m * (0.55 + 0.45 * rel) * mod * noise * 100, 0, 100));
            const assets = Math.max(1, Math.round(acct.assets * exposure[risk.id] * (0.85 + rand() * 0.3)));
            const magnitude =
              Math.round(clamp(risk.magnitude + (magnitudeBias[acct.id] || 0) + (rand() - 0.5) * 1.5, 1, 10) * 10) / 10;
            coverage[cellKey(risk.id, tool.id, acct.id)] = {
              coverage: cov,
              assets,
              magnitude,
              notes: cov === 0 ? 'Control not deployed in this scope.' : '',
            };
          }
        }
      }
    }
  }
  return {
    version: SCHEMA_VERSION,
    risks: structuredClone(risks),
    tools: structuredClone(tools),
    environments: structuredClone(environments),
    coverage,
  };
}
