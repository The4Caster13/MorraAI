import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Hero } from './sections/Hero';
import { About } from './sections/About';
import { HowItWorks } from './sections/HowItWorks';
import { Themes } from './sections/Themes';
import { Rubric } from './sections/Rubric';
import { Divider } from '../../components/ui';

/**
 * The whole marketing site is one scrolling page; the navbar links jump to the
 * sections below rather than navigating away.
 */
export function LandingPage() {
  const { hash } = useLocation();

  // Arriving from another route (e.g. /practice) with "/#themes" should land on
  // that section once it has rendered.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (!el) return;
    // Fires on a timer, so anything thrown here escapes React and surfaces as an
    // unhandled exception rather than a render error. scrollIntoView is absent
    // in jsdom and in some older browsers; failing to scroll is not worth
    // taking the page down for.
    const id = window.setTimeout(() => {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [hash]);

  return (
    <>
      <Hero />
      <Divider />
      <About />
      <Divider />
      <HowItWorks />
      <Divider />
      <Themes />
      <Divider />
      <Rubric />
    </>
  );
}
