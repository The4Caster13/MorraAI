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
    const id = window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 0);
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
