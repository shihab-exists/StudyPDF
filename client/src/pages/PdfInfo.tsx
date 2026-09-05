import React, { useEffect, useState } from 'react';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { formatBytes, getBlob } from '../services/store';
import { blobBytes, getPdfInfo, type PdfInfoResult } from '../services/pdfops';
import { friendly } from '../services/errors';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, ErrorState, SectionTitle, StatBox } from '../components/Bits';
import { Paperclip, Star, ToolInfoIcon } from '../components/Doodles';

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-dashed border-[rgba(18,49,92,.2)] last:border-0">
      <span className="font-hand text-[var(--ink-soft)] w-36 shrink-0">{label}</span>
      <span className="font-display font-bold text-[0.98rem] break-words min-w-0">{value || '—'}</span>
    </div>
  );
}

export default function PdfInfo() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [info, setInfo] = useState<PdfInfoResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInfo(null);
      setErr(null);
      if (!rec) return;
      setBusy(true);
      try {
        const blob = await getBlob(rec.id);
        if (!blob || cancelled) return;
        const result = await getPdfInfo(await blobBytes(blob));
        if (!cancelled) setInfo(result);
      } catch (e) {
        if (!cancelled) setErr(friendly(e));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rec?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, right: -34, ['--fr' as string]: '-6deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-cyan t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, left: 30 }} />
        <SectionTitle color="var(--blue-bright)">PDF Info</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Everything inside a PDF's ID card — read-only, your file is never modified.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <ToolInfoIcon size={28} />
              <p className="font-display font-bold truncate flex-1">{rec.originalName}</p>
              <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
            </div>

            {busy && <ProgressBar label="Reading metadata…" blue />}
            {err && <ErrorState message={err} />}

            {info && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox label="Pages" value={info.pages} />
                  <StatBox label="File size" value={formatBytes(rec.sizeBytes)} accent="var(--blue-bright)" />
                  <StatBox label="PDF version" value={info.version} />
                  <StatBox
                    label="Selectable text"
                    value={info.analysis.searchable ? 'Yes' : 'No'}
                    accent={info.analysis.searchable ? '#0d6b4e' : '#c23a2b'}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-5">
                  <div className="bg-white/70 rounded-xl px-4 py-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                    <p className="font-display font-extrabold text-lg mb-1">Document</p>
                    <Row label="Filename" value={rec.originalName} />
                    <Row
                      label="Page size"
                      value={
                        info.uniform
                          ? `${info.sizes[0]?.w} × ${info.sizes[0]?.h} pt`
                          : `${info.sizes.length} different sizes (${info.sizes.slice(0, 3).map((s) => `${s.w}×${s.h}`).join(', ')}…)`
                      }
                    />
                    <Row label="Appears scanned" value={info.analysis.hasImages && !info.analysis.searchable ? 'Yes — image-based' : info.analysis.hasImages ? 'Mixed (images + text)' : 'No — born-digital'} />
                    <Row label="Rotated pages" value={info.analysis.rotatedPages ? String(info.analysis.rotatedPages) : 'None'} />
                    <Row label="Text characters" value={info.analysis.textChars ? info.analysis.textChars.toLocaleString() : '0'} />
                  </div>
                  <div className="bg-white/70 rounded-xl px-4 py-3 border-2 border-dashed border-[rgba(18,49,92,.25)]">
                    <p className="font-display font-extrabold text-lg mb-1">Metadata</p>
                    <Row label="Title" value={info.meta.Title} />
                    <Row label="Author" value={info.meta.Author} />
                    <Row label="Subject" value={info.meta.Subject} />
                    <Row label="Keywords" value={info.meta.Keywords} />
                    <Row label="Creator" value={info.meta.Creator} />
                    <Row label="Producer" value={info.meta.Producer} />
                    <Row label="Created" value={info.meta.Created} />
                    <Row label="Modified" value={info.meta.Modified} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
