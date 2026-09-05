import React, { useCallback, useEffect, useState } from 'react';
import { downloadBlob, formatBytes, getBlob, listFiles, openInTab, removeFile } from '../services/store';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import { SectionTitle } from '../components/Bits';
import { useToast } from '../components/Toasts';
import {
  CompressIcon, DownloadIcon, EyeIcon, FolderIcon, FromImagesIcon, LockIcon, MergeIcon,
  NumbersIcon, OcrIcon, PagesIcon, PdfDocIcon, RotateAllIcon, SplitIcon, TextIcon,
  TrashIcon, WatermarkIcon,
} from '../components/Doodles';
import { FILE_TTL_HOURS } from '../config';

const TOOL_ICON: Record<string, (p: { size?: number }) => React.ReactElement> = {
  compress: (p) => <CompressIcon {...p} />,
  merge: (p) => <MergeIcon {...p} />,
  split: (p) => <SplitIcon {...p} />,
  pages: (p) => <PagesIcon {...p} />,
  extract: (p) => <PagesIcon {...p} />,
  rotate: (p) => <RotateAllIcon {...p} />,
  numbers: (p) => <NumbersIcon {...p} />,
  watermark: (p) => <WatermarkIcon {...p} />,
  protect: (p) => <LockIcon {...p} />,
  'from-images': (p) => <FromImagesIcon {...p} />,
  ocr: (p) => <OcrIcon {...p} />,
  enhance: (p) => <OcrIcon {...p} />,
  text: (p) => <TextIcon {...p} />,
  upload: (p) => <PdfDocIcon {...p} />,
};

const TOOL_LABEL: Record<string, string> = {
  compress: 'Compressed',
  merge: 'Merged',
  split: 'Split part',
  pages: 'Page edits',
  extract: 'Extracted',
  rotate: 'Rotated',
  numbers: 'Numbered',
  watermark: 'Watermarked',
  protect: 'Protected',
  'from-images': 'Images → PDF',
  word: 'Word document',
  pptx: 'PowerPoint',
  xlsx: 'Excel spreadsheet',
  ocr: 'OCR / searchable',
  enhance: 'Enhanced',
  text: 'Extracted text',
  upload: 'Upload',
};

export default function MyFiles() {
  const [files, setFiles] = useState<FileRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(() => {
    setError(null);
    listFiles()
      .then(setFiles)
      .catch((e) => setError(friendly(e)));
  }, []);

  useEffect(load, [load]);

  const remove = async (id: string) => {
    try {
      await removeFile(id);
      toast('File deleted.', 'ok');
      setConfirmId(null);
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Delete failed.', 'error');
    }
  };

  const download = async (f: FileRecord) => {
    const blob = await getBlob(f.id);
    if (blob) downloadBlob(blob, f.originalName);
    else toast('That file is no longer in your browser storage.', 'error');
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-center" />
        <SectionTitle color="var(--blue-bright)">My Files</SectionTitle>
        <p className="font-hand text-[var(--ink-soft)] -mt-2 mb-5 flex items-center gap-2">
          <FolderIcon size={18} /> Recently processed files — stored only in this browser.{' '}
          <span className="mark-yellow font-display font-bold text-[var(--ink)]">Files are automatically deleted after {FILE_TTL_HOURS} hours.</span>
        </p>

        {error && (
          <div className="text-center py-8">
            <p className="font-hand text-lg text-[#c23a2b]">❌ {error}</p>
            <button className="btn btn-yellow mt-3" onClick={load}>Try Again</button>
          </div>
        )}

        {!error && files === null && (
          <div className="space-y-3 py-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-[rgba(18,49,92,.08)] animate-pulse" />
            ))}
          </div>
        )}

        {!error && files !== null && files.length === 0 && (
          <div className="text-center py-10">
            <FolderIcon size={54} color="#b9c6dd" />
            <p className="font-display font-extrabold text-xl mt-2">No files yet</p>
            <p className="font-hand text-[var(--ink-soft)]">Process a PDF and it will show up here (for 24 hours).</p>
          </div>
        )}

        {!error && files !== null && files.length > 0 && (
          <div>
            {files.map((f) => {
              const Icon = TOOL_ICON[f.tool] || TOOL_ICON.upload;
              return (
                <div key={f.id} className="file-row flex flex-wrap sm:flex-nowrap items-center gap-3 py-3">
                  <span className="sticker p-1.5 shrink-0"><Icon size={28} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-bold truncate" title={f.originalName}>{f.originalName}</p>
                    <p className="font-hand text-sm text-[var(--ink-soft)]">
                      {f.when} · {formatBytes(f.sizeBytes)} · {f.pages} page{f.pages === 1 ? '' : 's'} · {TOOL_LABEL[f.tool] || f.tool}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="icon-btn" onClick={() => void openInTab(f.id)} title="Open" aria-label={`Open ${f.originalName}`}>
                      <EyeIcon size={19} />
                    </button>
                    <button className="icon-btn" onClick={() => void download(f)} title="Download" aria-label={`Download ${f.originalName}`}>
                      <DownloadIcon size={19} />
                    </button>
                    {confirmId === f.id ? (
                      <span className="flex items-center gap-1">
                        <button className="btn btn-red btn-sm" onClick={() => void remove(f.id)}>Delete?</button>
                        <button className="btn btn-white btn-sm" onClick={() => setConfirmId(null)}>No</button>
                      </span>
                    ) : (
                      <button className="icon-btn" style={{ color: '#c23a2b' }} onClick={() => setConfirmId(f.id)} title="Delete" aria-label={`Delete ${f.originalName}`}>
                        <TrashIcon size={19} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
