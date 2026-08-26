import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';

// Renders the actual uploaded proof photo inline (not just a "view" link)
// so an admin can compare reported numbers against the screenshot without
// leaving the preview modal -- e.g. checking a mapping submission's
// buildings/roads figures against the member's HOTOSM contributions page
// screenshot, or verifying a project submission's photo is legitimate.
export function ProofPhoto({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setUrl(null);
    setError(false);
    if (!path) { return; }

    let cancelled = false;
    api.get<{ url: string }>(`/uploads/signed-url?filePath=${encodeURIComponent(path)}`)
      .then((result) => { if (!cancelled) { setUrl(result.url); } })
      .catch(() => { if (!cancelled) { setError(true); } });
    return () => { cancelled = true; };
  }, [path]);

  if (!path) { return <span className="text-muted">-</span>; }
  if (error) { return <span className="text-accent">Couldn&apos;t load photo</span>; }
  if (!url) { return <span className="text-muted">Loading…</span>; }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Submitted proof"
        className="max-h-[220px] max-w-full rounded-lg border border-border object-contain cursor-zoom-in"
      />
    </a>
  );
}

async function viewProofPhoto(path: string) {
  const result = await api.get<{ url: string }>(`/uploads/signed-url?filePath=${encodeURIComponent(path)}`);
  if (result.url) { window.open(result.url, '_blank', 'noopener,noreferrer'); }
}

// Compact text-link version for a narrow table cell, where an inline
// thumbnail wouldn't fit -- ProofPhoto above is for the roomier preview
// modals where seeing the actual image inline is the point.
export function ProofLink({ path }: { path: string | null }) {
  if (!path) { return <span className="text-muted">-</span>; }
  return (
    <button onClick={() => viewProofPhoto(path)} className="text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline">
      View Photo
    </button>
  );
}
