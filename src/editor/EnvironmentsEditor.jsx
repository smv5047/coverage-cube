import { useState } from 'react';
import { uid } from '../data/model.js';
import { NumInput, TextInput, confirmDelete } from './fields.jsx';

const PRESETS = {
  Workstation: ['Platform', 'Device group'],
  Citrix: ['Delivery platform', 'Delivery group'],
  Cloud: ['Cloud service provider', 'Account / subscription'],
  'Data center': ['Site / platform', 'Cluster'],
};

export default function EnvironmentsEditor({ data, update }) {
  const [name, setName] = useState('');

  const addEnv = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    const [providerLabel, accountLabel] = PRESETS[n] || ['Provider', 'Account'];
    update((d) => d.environments.push({ id: uid('env'), name: n, providerLabel, accountLabel, providers: [] }));
    setName('');
  };

  const findEnv = (d, envId) => d.environments.find((x) => x.id === envId);
  const findProv = (d, envId, provId) => findEnv(d, envId)?.providers.find((p) => p.id === provId);

  return (
    <div className="ed-section">
      <h2>Environments</h2>
      <p className="muted">
        Environments form the Z axis. Each drills down to a provider level (e.g. cloud service provider) and then to
        accounts — coverage is recorded per account. Mark org roots as <b>management</b> accounts.
      </p>
      <form className="add-form" onSubmit={addEnv}>
        <input
          list="env-presets"
          placeholder="Environment, e.g. Cloud"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <datalist id="env-presets">
          {Object.keys(PRESETS).map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <button className="btn primary" type="submit">
          + Add environment
        </button>
      </form>

      {data.environments.map((env) => (
        <div key={env.id} className="env-card card">
          <div className="env-head">
            <TextInput
              className="strong"
              value={env.name}
              onChange={(v) => update((d) => (findEnv(d, env.id).name = v))}
            />
            <label className="inline">
              Level 2 label
              <TextInput
                value={env.providerLabel}
                onChange={(v) => update((d) => (findEnv(d, env.id).providerLabel = v))}
              />
            </label>
            <label className="inline">
              Level 3 label
              <TextInput
                value={env.accountLabel}
                onChange={(v) => update((d) => (findEnv(d, env.id).accountLabel = v))}
              />
            </label>
            <button
              className="btn danger small"
              onClick={() =>
                confirmDelete(`environment “${env.name}” and all its providers/accounts`, () =>
                  update((d) => (d.environments = d.environments.filter((x) => x.id !== env.id))),
                )
              }
            >
              Delete
            </button>
          </div>

          {env.providers.map((prov) => (
            <div key={prov.id} className="prov-card">
              <div className="prov-head">
                <span className="muted small">{env.providerLabel || 'Provider'}</span>
                <TextInput
                  className="strong"
                  value={prov.name}
                  onChange={(v) => update((d) => (findProv(d, env.id, prov.id).name = v))}
                />
                <button
                  className="btn danger small"
                  onClick={() =>
                    confirmDelete(`“${prov.name}” and its accounts`, () =>
                      update((d) => {
                        const e = findEnv(d, env.id);
                        e.providers = e.providers.filter((p) => p.id !== prov.id);
                      }),
                    )
                  }
                >
                  Delete
                </button>
              </div>
              <div className="table-wrap">
                <table className="ed-table compact">
                  <thead>
                    <tr>
                      <th>{env.accountLabel || 'Account'}</th>
                      <th>Type</th>
                      <th>Owner</th>
                      <th>Region</th>
                      <th>Total assets</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {prov.accounts.map((a) => {
                      const setA = (field, v) =>
                        update((d) => {
                          const acct = findProv(d, env.id, prov.id).accounts.find((x) => x.id === a.id);
                          acct[field] = v;
                        });
                      return (
                        <tr key={a.id}>
                          <td>
                            <TextInput value={a.name} onChange={(v) => setA('name', v)} />
                          </td>
                          <td>
                            <select value={a.type} onChange={(e) => setA('type', e.target.value)}>
                              <option value="account">Member</option>
                              <option value="management">Management</option>
                            </select>
                          </td>
                          <td>
                            <TextInput value={a.owner} onChange={(v) => setA('owner', v)} />
                          </td>
                          <td>
                            <TextInput value={a.region} onChange={(v) => setA('region', v)} />
                          </td>
                          <td>
                            <NumInput value={a.assets} min={0} onCommit={(v) => setA('assets', v)} />
                          </td>
                          <td>
                            <button
                              className="btn danger small"
                              onClick={() =>
                                confirmDelete(`“${a.name}”`, () =>
                                  update((d) => {
                                    const p = findProv(d, env.id, prov.id);
                                    p.accounts = p.accounts.filter((x) => x.id !== a.id);
                                  }),
                                )
                              }
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                className="btn ghost small"
                onClick={() =>
                  update((d) =>
                    findProv(d, env.id, prov.id).accounts.push({
                      id: uid('acct'),
                      name: `New ${(env.accountLabel || 'account').toLowerCase()}`,
                      type: 'account',
                      owner: '',
                      region: '',
                      assets: 100,
                    }),
                  )
                }
              >
                + Add {(env.accountLabel || 'account').toLowerCase()}
              </button>
            </div>
          ))}
          <button
            className="btn small"
            onClick={() =>
              update((d) =>
                findEnv(d, env.id).providers.push({
                  id: uid('prov'),
                  name: `New ${(env.providerLabel || 'provider').toLowerCase()}`,
                  accounts: [],
                }),
              )
            }
          >
            + Add {(env.providerLabel || 'provider').toLowerCase()}
          </button>
        </div>
      ))}
      {!data.environments.length && <p className="muted">No environments yet — try Workstation, Citrix or Cloud.</p>}
    </div>
  );
}
