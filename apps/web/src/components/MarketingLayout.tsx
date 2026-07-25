import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Logo } from './ui';

const NAV_LINKS = [
  { label: 'About', id: 'about' },
  { label: 'How it works', id: 'how' },
  { label: 'Themes', id: 'themes' },
  { label: 'Rubric', id: 'rubric' },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Highlight whichever section is currently in view.
  useEffect(() => {
    if (location.pathname !== '/') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveId(visible.target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.5] },
    );
    for (const { id } of NAV_LINKS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Sections live on "/", so from any other route go there first.
  const goToSection = useCallback(
    (id: string) => {
      setMenuOpen(false);
      if (location.pathname !== '/') {
        navigate(`/#${id}`);
        return;
      }
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    },
    [location.pathname, navigate],
  );

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.95)' : '#fff',
        borderBottom: `1px solid rgba(10,22,40,${scrolled ? 0.08 : 0.06})`,
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="Morra AI — accueil">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => goToSection(id)}
              aria-current={activeId === id ? 'true' : undefined}
              className={`text-sm font-medium transition-colors ${
                activeId === id ? 'text-brand' : 'text-slate-500 hover:text-brand'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex">
          <Link
            to="/practice"
            className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
          >
            Start practice →
          </Link>
        </div>

        <button
          className="md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X size={20} className="text-navy" /> : <Menu size={20} className="text-navy" />}
        </button>
      </div>

      {menuOpen && (
        <div
          className="flex flex-col gap-4 border-t px-6 py-4 md:hidden"
          style={{ borderColor: 'rgba(10,22,40,0.08)' }}
        >
          {NAV_LINKS.map(({ label, id }) => (
            <button
              key={id}
              onClick={() => goToSection(id)}
              className="text-left text-sm font-medium text-slate-500"
            >
              {label}
            </button>
          ))}
          <Link
            to="/practice"
            className="rounded-full bg-navy px-5 py-2.5 text-center text-sm font-semibold text-white"
          >
            Start practice →
          </Link>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t bg-white px-6 py-10" style={{ borderColor: 'rgba(10,22,40,0.07)' }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
        <Logo size="sm" />
        <p className="text-center text-xs text-slate-400">
          Built for IB Diploma French B students. Not affiliated with or endorsed by the IB.
        </p>
        <div className="flex items-center gap-4">
          <Link to="/history" className="text-xs text-slate-400 hover:text-brand">
            Mes sessions
          </Link>
          <span className="text-xs text-slate-400">© 2026 Morra AI</span>
        </div>
      </div>
    </footer>
  );
}

/** Chrome shared by the marketing page. App/exam routes render without it. */
export function MarketingLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-navy">
      <Navbar />
      <main id="main" className="flex-1 pt-16">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
