/**
 * Guards against the landing page white-screening on load.
 *
 * A `useEffect` with a concise arrow body returns its expression's value, which
 * React then tries to invoke as a cleanup function ("destroy is not a function")
 * — crashing the entire route. HTTP 200 from the dev server does not catch this,
 * because the crash happens after the HTML shell is served.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketingLayout } from './components/MarketingLayout';
import { LandingPage } from './pages/marketing/LandingPage';

const SECTION_TEXT = [
  ['hero', 'AI that masters'],
  ['about', 'Built for IB students'],
  ['how', 'Six steps'],
  ['themes', 'All 5 IB French B themes'],
  ['rubric', 'Marked the way'],
] as const;

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() }),
  );
  // Deliberately returns a value: an effect body must never pass a browser
  // return value through to React, which would treat it as a cleanup function.
  vi.stubGlobal('scrollTo', vi.fn().mockReturnValue(0));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }));
  // jsdom ships no IntersectionObserver; every target browser has one.
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

async function renderLanding(initialEntry = '/') {
  const errors: unknown[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args[0]));

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <StrictMode>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<LandingPage />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </StrictMode>,
    );
  });

  return { container, root, errors, spy };
}

describe('landing page', () => {
  it('mounts without crashing', async () => {
    const { container, root, errors, spy } = await renderLanding();

    const fatal = errors
      .map(String)
      .filter((e) => /destroy is not a function|must not return anything/.test(e));
    expect(fatal).toEqual([]);
    expect(container.textContent).toContain('Morra AI');

    await act(async () => root.unmount());
    spy.mockRestore();
  });

  it.each(SECTION_TEXT)('renders the %s section', async (_id, text) => {
    const { container, root, spy } = await renderLanding();
    expect(container.textContent).toContain(text);
    await act(async () => root.unmount());
    spy.mockRestore();
  });

  it('exposes an anchor target for every nav link', async () => {
    const { container, root, spy } = await renderLanding();
    for (const id of ['about', 'how', 'themes', 'rubric']) {
      expect(container.querySelector(`#${id}`), `missing section #${id}`).not.toBeNull();
    }
    await act(async () => root.unmount());
    spy.mockRestore();
  });

  it('no longer offers a waitlist', async () => {
    const { container, root, spy } = await renderLanding();
    expect(container.textContent).not.toContain('Join waitlist');
    expect(container.textContent).not.toContain('AI Practice Platform');
    await act(async () => root.unmount());
    spy.mockRestore();
  });

  it('still mounts when arriving with a section hash', async () => {
    const { container, root, errors, spy } = await renderLanding('/#themes');
    expect(container.textContent).toContain('All 5 IB French B themes');
    expect(errors.map(String).filter((e) => /destroy is not a function/.test(e))).toEqual([]);
    await act(async () => root.unmount());
    spy.mockRestore();
  });
});
