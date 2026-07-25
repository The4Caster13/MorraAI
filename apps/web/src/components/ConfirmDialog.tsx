import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button red for a destructive action. */
  danger?: boolean;
}

/**
 * A React-rendered stand-in for `window.confirm`, styled to match the rest of
 * the site instead of the browser's unstyleable native dialog.
 *
 * `confirm(...)` has the same call shape as the native version — pass a
 * string, `await` a boolean — so replacing a call site is a one-line change.
 * Render `dialog` once near the root of whichever component calls `confirm`.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    setOptions(typeof opts === 'string' ? { message: opts } : opts);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setOptions(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const dialog = options ? (
    <ConfirmOverlay
      options={options}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
    />
  ) : null;

  return { confirm, dialog };
}

function ConfirmOverlay({
  options,
  onCancel,
  onConfirm,
}: {
  options: ConfirmOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/50 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-message"
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        style={{ border: '1px solid rgba(10,22,40,0.08)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {options.title && (
          <h2 className="mb-2 font-display text-lg font-bold text-navy">{options.title}</h2>
        )}
        <p id="confirm-dialog-message" className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
          {options.danger && (
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" aria-hidden="true" />
          )}
          {options.message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button ref={confirmRef} variant={options.danger ? 'danger' : 'accent'} onClick={onConfirm}>
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
