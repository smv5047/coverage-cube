export default function Breadcrumb({ env, provider, zTitle, onGo }) {
  return (
    <nav className="card crumbs" aria-label="Drill path">
      <button className={!env ? 'cur' : ''} onClick={() => env && onGo('root')}>
        All environments
      </button>
      {env && (
        <>
          <span className="sep">›</span>
          <button className={!provider ? 'cur' : ''} onClick={() => provider && onGo('env')}>
            {env.name}
          </button>
        </>
      )}
      {provider && (
        <>
          <span className="sep">›</span>
          <button className="cur">{provider.name}</button>
        </>
      )}
      <span className="crumb-level">Z = {zTitle}</span>
    </nav>
  );
}
