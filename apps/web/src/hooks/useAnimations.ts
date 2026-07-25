import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Cycles through phrases with a typing/deleting effect. */
export function useTypewriter(phrases: string[], speed = 55, pause = 1800) {
  const [displayed, setDisplayed] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // With reduced motion, show the first phrase statically rather than animating.
    if (prefersReducedMotion()) {
      setDisplayed(phrases[0]);
      return;
    }
    const current = phrases[phraseIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!deleting && charIdx < current.length) {
      timeout = setTimeout(() => setCharIdx((c) => c + 1), speed);
    } else if (!deleting && charIdx === current.length) {
      timeout = setTimeout(() => setDeleting(true), pause);
    } else if (deleting && charIdx > 0) {
      timeout = setTimeout(() => setCharIdx((c) => c - 1), speed / 2);
    } else {
      setDeleting(false);
      setPhraseIdx((i) => (i + 1) % phrases.length);
    }

    setDisplayed(current.slice(0, charIdx));
    return () => clearTimeout(timeout);
  }, [charIdx, deleting, phraseIdx, phrases, speed, pause]);

  return displayed;
}

/** Runs a GSAP entrance animation on mount, scoped to the returned ref. */
export function useEntranceAnimation<T extends HTMLElement>(
  build: (ctx: { selector: string }) => void,
) {
  const ref = useRef<T>(null);
  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (prefersReducedMotion() || !ref.current) return;
    const ctx = gsap.context(() => buildRef.current({ selector: '' }), ref);
    return () => ctx.revert();
  }, []);

  return ref;
}

/** Reveals matching children once the container scrolls into view. */
export function useScrollReveal<T extends HTMLElement>(
  childSelector: string,
  options: { y?: number; x?: number; stagger?: number } = {},
) {
  const ref = useRef<T>(null);
  const { y = 40, x = 0, stagger = 0.1 } = options;

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        // fromTo + clearProps so an interrupted tween can't strand content at
        // opacity 0 — see the note in PracticePage.
        gsap.fromTo(
          el.querySelectorAll(childSelector),
          { opacity: 0, y, x },
          {
            opacity: 1,
            y: 0,
            x: 0,
            stagger,
            duration: 0.65,
            ease: 'power3.out',
            clearProps: 'all',
          },
        );
        observer.disconnect();
      },
      { threshold: 0.12 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [childSelector, y, x, stagger]);

  return ref;
}
