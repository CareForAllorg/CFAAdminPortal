import { useEffect, useState } from 'react';
import { api } from '../../lib/apiClient';

// Renders the actual uploaded proof photo inline (not just a "view" link)
// so an admin can compare reported numbers against the screenshot without
// leaving the preview modal -- e.g. checking a mapping submission's
// buildings/roads figures against the member's HOTOSM contributions page
// screenshot, or verifying a project submission's photo is legitimate.
// `linkToFullSize` wraps the image in its own <a> that opens the full-size
// photo in a new tab -- turn it off when the caller already wraps ProofPhoto
// in its own clickable element (e.g. a gallery grid item), since a nested
// <a> inside a <button> is invalid markup and the two clicks would fight
// each other.
export function ProofPhoto({ path, linkToFullSize = true, className }: { path: string | null; linkToFullSize?: boolean; className?: string }) {
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

  const img = (
    <img
      src={url}
      alt="Submitted proof"
      className={className ?? 'max-h-[220px] max-w-full rounded-lg border border-border object-contain cursor-zoom-in'}
    />
  );

  if (!linkToFullSize) { return img; }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {img}
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

// A plain <a href download> doesn't reliably force a save for a
// cross-origin signed Storage URL (browsers tend to just open/navigate
// instead) -- fetching the actual bytes and saving via a local blob URL
// works regardless of origin, which matters here since the point is
// pulling photos out for social media, not just viewing them.
export async function downloadProofPhoto(path: string) {
  const { url } = await api.get<{ url: string }>(`/uploads/signed-url?filePath=${encodeURIComponent(path)}`);
  const blob = await fetch(url).then((res) => res.blob());
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = path.split('/').pop() || 'proof-photo';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export function ProofDownloadButton({ path }: { path: string | null }) {
  const [downloading, setDownloading] = useState(false);
  if (!path) { return null; }

  async function handleClick() {
    setDownloading(true);
    try {
      await downloadProofPhoto(path as string);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="text-[12.5px] font-bold text-brand bg-none border-none cursor-pointer font-sans hover:underline disabled:opacity-50 flex items-center gap-[5px]"
    >
      <i className="ti ti-download text-[14px]" /> {downloading ? 'Downloading…' : 'Download'}
    </button>
  );
}
