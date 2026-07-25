import { MAX_NOTEPAD_BULLETS } from '@parlons/shared';

export function NotepadEditor({
  bullets,
  onChange,
}: {
  bullets: string[];
  onChange: (bullets: string[]) => void;
}) {
  const update = (index: number, value: string) => {
    const next = [...bullets];
    next[index] = value;
    onChange(next);
  };

  const addBullet = () => {
    if (bullets.length >= MAX_NOTEPAD_BULLETS) return;
    onChange([...bullets, '']);
  };

  const removeBullet = (index: number) => {
    onChange(bullets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-slate-900">Vos notes</h2>
        <p className="text-xs text-slate-500">
          {bullets.length}/{MAX_NOTEPAD_BULLETS} points
        </p>
      </div>
      <ul className="space-y-2">
        {bullets.map((bullet, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="text-slate-400" aria-hidden="true">
              •
            </span>
            <input
              type="text"
              value={bullet}
              onChange={(e) => update(i, e.target.value)}
              aria-label={`Point ${i + 1}`}
              maxLength={300}
              className="flex-1 rounded border border-slate-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            />
            <button
              type="button"
              onClick={() => removeBullet(i)}
              aria-label={`Supprimer le point ${i + 1}`}
              className="rounded px-2 py-1 text-sm text-slate-400 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={addBullet}
        disabled={bullets.length >= MAX_NOTEPAD_BULLETS}
        className="rounded border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-indigo-400 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Ajouter un point
      </button>
      {bullets.length >= MAX_NOTEPAD_BULLETS && (
        <p className="text-xs text-amber-700">
          Limite de {MAX_NOTEPAD_BULLETS} points atteinte, comme lors du véritable examen.
        </p>
      )}
    </div>
  );
}
