import type { CriterionResult } from '@parlons/shared';

const CRITERION_TITLES: Record<string, string> = {
  A: 'Critère A — Langue',
  B1: 'Critère B1 — Message : stimulus',
  B2: 'Critère B2 — Message : conversation',
  C: 'Critère C — Compétences interactives',
};

export function ScoreCard({
  criterion,
  max,
  result,
}: {
  criterion: 'A' | 'B1' | 'B2' | 'C';
  max: number;
  result: CriterionResult;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-semibold text-slate-900">{CRITERION_TITLES[criterion]}</h3>
        <p className="font-mono text-xl tabular-nums text-indigo-700">
          {result.mark}
          <span className="text-sm text-slate-400">/{max}</span>
        </p>
      </header>
      <p className="mb-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        {result.band}
      </p>
      <p className="mb-3 text-sm text-slate-700">{result.justification}</p>
      {result.evidenceQuotes.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Extraits cités
          </p>
          <ul className="space-y-1">
            {result.evidenceQuotes.map((q, i) => (
              <li key={i} className="border-l-2 border-indigo-200 pl-3 text-sm italic text-slate-600">
                « {q} »
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
