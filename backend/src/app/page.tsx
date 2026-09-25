export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>StartupSignals API</h1>
      <ul>
        <li>
          <a href="/api/health">/api/health</a>
        </li>
        <li>
          <a href="/api/companies">/api/companies</a> — ranked companies (override weights with
          ?funding=40&amp;ip=25)
        </li>
        <li>/api/companies/[id] — one company plus its source records</li>
        <li>
          <a href="/api/sectors">/api/sectors</a> — sectors ranked by depth, breadth and growth
        </li>
      </ul>
    </main>
  );
}
