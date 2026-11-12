# Coverage Cube

A 3D coverage map for security practitioners. It shows how well each **risk** is covered by each **tool or process** in each **environment**. You can drill from the executive view down to a single cloud account.

**Live demo:** https://smv5047.github.io/coverage-cube/

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

`npm run build && npm run preview` serves a production build. `npm test` runs the import/export and summary tests. You need Node 18 or later.

To view it from another computer on your network, `npm run dev` already listens on all interfaces: open the "Network" URL Vite prints, for example `http://192.168.1.20:5173`.

`npm run build:artifact` packs the whole app into one self-contained HTML file (`dist/coverage-cube.artifact.html`). Use it for single-file hosting, such as a claude.ai artifact.

## Presenting to leadership

The app opens on **Summary**, a one-page view built for a CISO or leadership review:

- **Five headline numbers**: overall coverage against your target, risks on target in every environment, risk/environment pairs below target, pairs with no control mapped, and pairs relying on a single control. Each shows the change since your last snapshot.
- **Key findings** in plain sentences: the weakest environment, the least-covered risk, unmapped risks, and the largest exposure.
- **Risk × environment heatmap** using the strongest control for each risk. Select any cell to open that cube in 3D.
- **Tool × environment heatmap** showing how well each tool or process is deployed.
- **Priorities**: every pair that misses the target, ranked by exposure.
- **Trend**: choose **Save snapshot** after each review to track progress over time.

**Print / save PDF** produces a light, paper-friendly report. **Copy summary** gives text for an email or slide, and **Export tables (CSV)** gives the heatmaps and priorities as a spreadsheet. The report title is editable, and the target is the "Gap below" setting in the Cube view.

## Getting your data in

Switch to **My data → Edit data → Import & export**:

1. **Download template** (CSV). It has the column headers and six example rows. A high-level sheet needs only four columns: `Risk`, `Tool / process`, `Environment`, `Coverage %`. Optional columns add provider, account, account type, owner, assets, risk magnitude and notes.
2. **Import** by dropping the file, choosing it, or pasting rows copied from a spreadsheet. A preview shows what will be added, updated and skipped, with a reason for each skipped row. Choose **Add to my data** (matches by name, keeps everything else) or **Replace my data**.
3. **Tweak** in the coverage matrix, or select an account-level cube and adjust its coverage, assets and notes in the side panel.

**Export my data** writes the same format back out, so the round trip is: export, edit in Excel or Sheets, import. **Export fill-in sheet** lists every risk × tool × account combination with blanks to complete. A JSON backup keeps everything, including the title and snapshots.

All data stays in the browser's local storage; nothing is uploaded.

## What you see

| Encoding | Meaning |
| --- | --- |
| **X axis** | Risks (ransomware, credential phishing, …) |
| **Y axis** | Tools (purple labels mark processes) |
| **Z axis** | Environment → provider (CSP / platform) → account. The axis changes as you drill down. |
| **Cube size** | Toggle: **asset volume** or **risk magnitude**, on a square-root scale |
| **Cube color** | Coverage strength: red (0%) → yellow (50%) → green (100%) |
| **Red wireframe cube** | A risk with **no control mapped** in that environment (it sits on the "∅ No control mapped" row) |

Each axis has its own color (risk is blue, tool is violet, environment is pink), and the same colors appear on the labels, the floor lanes and the **Find a cube** picker.

**Find a cube:** choose a risk, a tool and an environment (for example *MCP discovery × Wiz × Cloud*). That cube is pinned: everything else fades, dashed guide lines run from it to its three axis labels, the labels light up, and a tag above it shows its name and coverage. Clicking a cube does the same.

**Navigation:** drag to rotate. Scroll or pinch to zoom. Right-drag or two-finger drag pans. **⟲ View** resets the camera.

### Progressive disclosure

1. **Executive view.** The whole cube is shown, with headline KPIs: asset-weighted coverage, gaps, zero-coverage cells, and unmapped risks. **Highlight → Gaps / No coverage** dims healthy cells and pulses the problem cells. The **Gap below** slider sets the threshold.
2. **Click a cube** to open its detail: coverage, assets, magnitude, every control for that risk in scope, and the best single-control coverage.
3. **Drill down.** Double-click a cube, use **Open … in 3D**, or click a row in the detail panel's breakdown. The path goes environment → cloud service provider (or platform) → account. At account level you get the account record: member vs. **management account**, owner, region and notes. The breadcrumb takes you back up.
4. With nothing selected, the side panel shows the **Gap queue**: gaps ranked by residual exposure, `magnitude × assets × (1 − coverage)`.

## Modes

- **Demo → Overview** (the default) is a small, high-level picture: 6 risks (including MCP discovery), 6 named products (Wiz, CrowdStrike, Okta, Purview DLP, Splunk, Tenable) and 3 environments (Workstation, Citrix, Cloud).
- **Demo → Detailed** loads a larger deterministic dataset: 10 risks, 11 tools and processes, and 4 environments (Workstation, Citrix, Cloud with AWS/Azure/GCP including management accounts, and Data center). It includes realistic gaps, such as a dev sandbox with no EDR, contractors on Citrix with no DLP, and supply-chain risk unmapped outside the cloud. **Copy to Input** gives you an editable copy.
- **My data** is your own data, saved automatically to `localStorage`. **Edit data** has forms for:
  - **Risks**: name, category, magnitude 1–10, description, ordering
  - **Tools & processes**: name, kind, vendor or owner, description
  - **Environments**: environment → provider → account. Level labels, member/management type, owner, region and total assets are all editable.
  - **Coverage & metrics**: a risk × control matrix per account. Switch the field between coverage %, asset volume and risk magnitude. A blank coverage cell means *not mapped*; `0` means *mapped but no coverage*. Bulk actions: copy the mapping from another account, fill blanks, clear an account.
  - **Import & export**: the spreadsheet template, import and backup described above.

## Data model

Coverage is stored per leaf account, keyed `riskId|toolId|accountId` → `{ coverage, assets, magnitude, notes }`. Provider and environment cells are asset-weighted roll-ups of their accounts (`src/data/model.js`).

```
src/
  App.jsx                  state: mode, drill path, selection, filters
  data/model.js            hierarchy helpers, aggregation, color encoding
  data/demo.js             seeded demo dataset
  data/storage.js          localStorage persistence
  data/csv.js              spreadsheet template, export and import
  data/report.js           summary metrics, findings, snapshots
  components/Brief.jsx     leadership summary view
  components/Scene.jsx     react-three-fiber cube, axes, camera, controls
  components/TextSprite.jsx offline canvas-texture labels
  components/DetailPanel.jsx cell detail, drill breakdown, gap queue
  editor/*                 input-mode forms
```

## Deployment

Every push to `main` runs `.github/workflows/deploy.yml`, which builds the app and publishes `dist/` to the `gh-pages` branch. GitHub Pages serves that branch at https://smv5047.github.io/coverage-cube/. Vite uses relative asset paths (`base: './'`), so the build works under that sub-path.
