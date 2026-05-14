import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

// Visible warning rendered at the top of the SPA when the backend is not
// connected end-to-end. Tells the operator exactly what's wrong (missing env
// vars, schema not loaded, etc.) so writes that vanish on refresh have a
// clear root cause.
export const DemoModeBanner = ({ health }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const hint = health?.hint
    || 'API not reachable. Edits will not persist past a page refresh.';
  const missing = Array.isArray(health?.missingEnvVars) ? health.missingEnvVars : [];

  return (
    <div
      data-testid="demo-mode-banner"
      className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 flex items-start gap-3 text-xs"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
      <div className="flex-1 min-w-0">
        <span className="font-semibold">Demo mode</span>
        <span className="mx-2">·</span>
        <span>{hint}</span>
        {missing.length > 0 && (
          <span className="ml-2">
            Missing env vars: <code className="px-1 bg-amber-100 rounded">{missing.join(', ')}</code>
          </span>
        )}
        {health?.dbError && (
          <span className="ml-2">DB error: <code className="px-1 bg-amber-100 rounded">{health.dbError}</code></span>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-amber-800 hover:text-amber-950"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
