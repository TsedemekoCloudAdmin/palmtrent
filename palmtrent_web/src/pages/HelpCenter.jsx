import { useState, useMemo } from 'react';
import { helpSections, PLATFORMS } from '../data/helpContent';

// In-app User Guide / Help Center for the whole platform (web + mobile flows).
// Public route: /help
export default function HelpCenter() {
  const [activeId, setActiveId] = useState(helpSections[0].id);
  const [platform, setPlatform] = useState('all'); // all | web | mobile
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  // Filter flows by platform + search; keep only sections with matches.
  const sections = useMemo(() => {
    return helpSections
      .map((section) => {
        const flows = section.flows.filter((f) => {
          const platformOk = platform === 'all' || f.platforms.includes(platform);
          if (!platformOk) return false;
          if (!q) return true;
          const hay = `${section.title} ${f.title} ${f.steps.join(' ')} ${f.result}`.toLowerCase();
          return hay.includes(q);
        });
        return { ...section, flows };
      })
      .filter((s) => s.flows.length > 0);
  }, [platform, q]);

  const active = sections.find((s) => s.id === activeId) || sections[0];

  return (
    <div style={st.page}>
      <header style={st.header}>
        <div style={st.headerInner}>
          <div>
            <h1 style={st.title}>PalmTrent User Guide</h1>
            <p style={st.subtitle}>Step-by-step help for every flow — web and mobile.</p>
          </div>
          <a href="/" style={st.backBtn}>← Back to app</a>
        </div>
        <div style={st.controls}>
          <div style={st.toggle}>
            {['all', 'web', 'mobile'].map((p) => (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                style={{ ...st.toggleBtn, ...(platform === p ? st.toggleBtnActive : {}) }}
              >
                {p === 'all' ? 'All' : PLATFORMS[p]}
              </button>
            ))}
          </div>
          <input
            style={st.search}
            placeholder="Search the guide…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <div style={st.body}>
        <nav style={st.sidebar}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              style={{ ...st.navItem, ...((active && active.id === s.id) ? st.navItemActive : {}) }}
            >
              {s.title}
              <span style={st.navCount}>{s.flows.length}</span>
            </button>
          ))}
          {sections.length === 0 && <p style={st.empty}>No topics match your search.</p>}
        </nav>

        <main style={st.content}>
          {active ? (
            <>
              <h2 style={st.sectionTitle}>{active.title}</h2>
              <p style={st.sectionSummary}>{active.summary}</p>
              {active.flows.map((flow) => (
                <article key={flow.title} style={st.card}>
                  <div style={st.cardHead}>
                    <h3 style={st.flowTitle}>{flow.title}</h3>
                    <div style={st.chips}>
                      {flow.platforms.map((p) => (
                        <span key={p} style={{ ...st.chip, ...(p === 'web' ? st.chipWeb : st.chipMobile) }}>{PLATFORMS[p]}</span>
                      ))}
                    </div>
                  </div>
                  <ol style={st.steps}>
                    {flow.steps.map((step, i) => <li key={i} style={st.step}>{step}</li>)}
                  </ol>
                  <div style={st.result}>
                    <span style={st.resultLabel}>✓ End result</span>
                    <span>{flow.result}</span>
                  </div>
                </article>
              ))}
            </>
          ) : (
            <p style={st.empty}>Nothing to show. Try clearing the search or platform filter.</p>
          )}
        </main>
      </div>
    </div>
  );
}

const st = {
  page: { minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif', color: '#0f172a' },
  header: { background: '#0C2D48', color: '#fff', padding: '20px 24px' },
  headerInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, maxWidth: 1100, margin: '0 auto' },
  title: { margin: 0, fontSize: 24, fontWeight: 800 },
  subtitle: { margin: '4px 0 0', color: '#cbd5e1', fontSize: 14 },
  backBtn: { color: '#fff', textDecoration: 'none', background: '#F37021', padding: '8px 14px', borderRadius: 10, fontWeight: 700, fontSize: 14 },
  controls: { display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 1100, margin: '14px auto 0', alignItems: 'center' },
  toggle: { display: 'flex', gap: 4, background: 'rgba(255,255,255,0.12)', padding: 4, borderRadius: 10 },
  toggleBtn: { border: 'none', background: 'transparent', color: '#cbd5e1', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13 },
  toggleBtnActive: { background: '#fff', color: '#0C2D48' },
  search: { flex: 1, minWidth: 220, minHeight: 40, borderRadius: 10, border: 'none', padding: '0 14px', fontSize: 14 },
  body: { display: 'flex', gap: 20, maxWidth: 1100, margin: '20px auto', padding: '0 24px', alignItems: 'flex-start' },
  sidebar: { width: 240, flexShrink: 0, position: 'sticky', top: 20, display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', border: '1px solid #e2e8f0', background: '#fff', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#334155' },
  navItemActive: { background: '#0C2D48', color: '#fff', borderColor: '#0C2D48' },
  navCount: { fontSize: 11, fontWeight: 800, opacity: 0.7 },
  content: { flex: 1, minWidth: 0 },
  sectionTitle: { margin: '0 0 4px', fontSize: 22, fontWeight: 800 },
  sectionSummary: { margin: '0 0 16px', color: '#64748b' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 18, marginBottom: 14 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  flowTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: '#0C2D48' },
  chips: { display: 'flex', gap: 6 },
  chip: { fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 999 },
  chipWeb: { background: '#dbeafe', color: '#1e40af' },
  chipMobile: { background: '#fef3c7', color: '#92400e' },
  steps: { margin: '12px 0 0', paddingLeft: 20 },
  step: { marginBottom: 6, lineHeight: 1.5 },
  result: { marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 2 },
  resultLabel: { color: '#15803d', fontWeight: 800, fontSize: 12 },
  empty: { color: '#64748b', padding: 12 }
};
