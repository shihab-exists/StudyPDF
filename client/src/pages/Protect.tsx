import React, { useState } from 'react';
import UploadBox from '../components/UploadBox';
import { useFileParam } from '../hooks/useFileParam';
import { baseName, getBlob, saveResult } from '../services/store';
import { blobBytes, loadDoc, docBytes, pdfBytes } from '../services/pdfops';
import { friendly } from '../services/errors';
import type { FileRecord } from '../types';
import ProgressBar from '../components/ProgressBar';
import { BackToTools, DownloadButtons, ErrorState, SectionTitle, SuccessBanner } from '../components/Bits';
import { LockIcon, Paperclip, Star } from '../components/Doodles';
import { useToast } from '../components/Toasts';

/**
 * Real encryption: the document is sealed with the PDF standard security
 * handler (AES-256, /V 5 /R 6 — the algorithm ISO 32000-2 recommends).
 * Opening the downloaded file genuinely requires the password.
 */
export default function Protect() {
  const { rec, setRec, clear, loading, error: loadError, retry } = useFileParam();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [printing, setPrinting] = useState(true);
  const [copying, setCopying] = useState(true);
  const [modifying, setModifying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FileRecord | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();

  const run = async () => {
    if (!rec) return;
    setErr(null);
    if (password.length < 4) {
      setErr('Use a password with at least 4 characters.');
      return;
    }
    if (password !== confirm) {
      setErr('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const blob = await getBlob(rec.id);
      if (!blob) throw new Error('That file is no longer in your browser storage.');
      const doc = await loadDoc(await blobBytes(blob));
      doc.encrypt({
        userPassword: password,
        ownerPassword: password,
        permissions: {
          printing: printing ? 'highResolution' : false,
          copying,
          modifying,
          annotating: false,
          fillingForms: true,
          contentAccessibility: true,
          documentAssembly: false,
        },
      });
      const bytes = await docBytes(doc);
      const saved = await saveResult(`${baseName(rec.originalName)}_protected.pdf`, pdfBytes(bytes), 'protect', rec.pages);
      setResult(saved);
      toast(`✓ Encrypted with AES-256 — password now required`, 'ok');
    } catch (e) {
      const msg = friendly(e);
      setErr(msg);
      toast(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty hidden md:block" style={{ top: -12, left: -34, ['--fr' as string]: '-9deg' }} />
      <div className="mb-4"><BackToTools /></div>
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-8 relative">
        <span className="tape t-center" />
        <Paperclip size={28} className="doodle" style={{ top: 8, right: 34 }} />
        <SectionTitle color="#0d6b4e">Protect PDF</SectionTitle>
        <p className="font-hand text-lg text-[var(--ink-soft)] -mt-2 mb-6">
          Password-encrypt your PDF with <span className="mark-yellow font-display font-bold text-[var(--ink)]">real AES-256 encryption</span> — opening it will genuinely require the password.
        </p>

        {loadError && <ErrorState message={loadError} onRetry={retry} />}
        {!rec && !loadError && <UploadBox onUploaded={setRec} title="Drop your PDF here" />}
        {loading && <ProgressBar label="Loading file…" />}

        {rec && !result && (
          <div className="space-y-5">
            <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)] flex items-center gap-3 py-2.5">
              <LockIcon size={26} />
              <p className="font-display font-bold truncate flex-1">{rec.originalName}</p>
              <button className="btn btn-white btn-sm" onClick={clear}>Change</button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="font-display font-bold">Password</span>
                <input className="input-paper mt-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy} autoComplete="new-password" placeholder="At least 4 characters" />
              </label>
              <label className="block">
                <span className="font-display font-bold">Confirm password</span>
                <input className="input-paper mt-1" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={busy} autoComplete="new-password" />
              </label>
            </div>

            <fieldset className="border-0 m-0 p-0">
              <legend className="font-display font-extrabold text-lg mb-2">Allow readers to… (optional)</legend>
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="chk bg-white/60 rounded-xl px-3 py-2">
                  <input type="checkbox" checked={printing} onChange={(e) => setPrinting(e.target.checked)} disabled={busy} />
                  <span className="box" /><span className="font-display font-bold">Print</span>
                </label>
                <label className="chk bg-white/60 rounded-xl px-3 py-2">
                  <input type="checkbox" checked={copying} onChange={(e) => setCopying(e.target.checked)} disabled={busy} />
                  <span className="box" /><span className="font-display font-bold">Copy text</span>
                </label>
                <label className="chk bg-white/60 rounded-xl px-3 py-2">
                  <input type="checkbox" checked={modifying} onChange={(e) => setModifying(e.target.checked)} disabled={busy} />
                  <span className="box" /><span className="font-display font-bold">Modify</span>
                </label>
              </div>
              <p className="font-hand text-sm text-[var(--ink-soft)] mt-2">
                Note: the password is the real protection. Print/copy/modify flags are permission hints — most viewers honour them, but a determined attacker with the password can change them.
              </p>
            </fieldset>

            <p className="font-hand text-sm text-[#c23a2b] bg-[#ffd7d3] rounded-xl px-3 py-2">
              ⚠️ Remember this password — there is no recovery. If you lose it, the file cannot be opened.
            </p>

            {busy ? (
              <ProgressBar label="Encrypting your PDF…" />
            ) : (
              <button className="btn btn-mint btn-lg w-full" onClick={run} disabled={!password}>
                <LockIcon size={20} /> Encrypt PDF
              </button>
            )}
            {err && <ErrorState message={err} />}
          </div>
        )}

        {result && (
          <div className="space-y-5 text-center">
            <SuccessBanner>PDF encrypted (AES-256) — the password is now required to open it</SuccessBanner>
            <div className="flex justify-center"><DownloadButtons rec={result} /></div>
            <p className="font-hand text-[var(--ink-soft)] max-w-md mx-auto">
              Heads-up: StudyPDF cannot open password-protected files, so run Protect as your <b>last</b> step.
            </p>
            <button className="btn btn-white" onClick={() => { setResult(null); clear(); }}>Protect another PDF</button>
          </div>
        )}
      </div>
    </div>
  );
}
