import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import UploadBox from '../components/UploadBox';
import ToolCard, { CORE_TOOLS, MORE_TOOLS } from '../components/ToolCard';
import { SectionTitle, FileRow } from '../components/Bits';
import { ArrowRight, BoltIcon, ClockIcon, Crown, LockIcon, Paperclip, ScribbleStar, Sparkle, Star, ArrowCurve } from '../components/Doodles';
import type { FileRecord } from '../types';

export default function Home() {
  const [rec, setRec] = useState<FileRecord | null>(null);
  const navigate = useNavigate();

  return (
    <div className="relative">
      {/* margin doodles */}
      <Star size={34} className="doodle floaty hidden lg:block" style={{ top: -6, left: '-56px', ['--fr' as string]: '-10deg' }} />
      <ScribbleStar size={30} className="doodle hidden lg:block" style={{ top: 190, right: '-52px', color: 'var(--yellow)' }} />
      <p className="doodle hidden xl:block font-script text-white text-2xl -rotate-6 leading-tight" style={{ top: 120, left: '-150px', width: 130 }}>
        Better Files<br />Better Grades <span aria-hidden>:)</span>
      </p>

      <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6 items-stretch">
        {/* hero sheet */}
        <section className="paper torn-sheet holes rounded-md px-7 sm:px-10 py-9 pl-12 sm:pl-16 relative">
          <Crown size={44} className="doodle" style={{ top: 26, left: '34%' }} />
          <Sparkle size={20} className="doodle" style={{ top: 40, right: 40, color: 'var(--blue-bright)' }} />
          <h1 className="font-display font-extrabold text-5xl sm:text-7xl leading-none sticker-outline mt-6 -rotate-1">
            <span className="logo-study">Study</span>
            <span className="logo-pdf">PDF</span>
          </h1>
          <p className="mt-4 inline-block">
            <span className="mark-yellow font-display font-extrabold text-xl sm:text-2xl text-[var(--ink)]">
              Simple PDF tools for students.
            </span>
          </p>
          <p className="font-hand text-xl text-[var(--blue-bright)] mt-4 max-w-sm leading-snug">
            Compress, merge, manage and clean your PDFs — all in one place.
          </p>
          <ScribbleStar size={34} className="doodle hidden sm:block" style={{ bottom: 60, right: 26, color: 'var(--blue-bright)' }} />
          <Star size={26} className="doodle floaty" style={{ bottom: 26, left: '46%', ['--fr' as string]: '8deg' }} />
        </section>

        {/* upload sheet */}
        <section className="paper torn-sheet rounded-md p-5 sm:p-7 relative">
          <span className="tape t-center" />
          <Paperclip size={30} className="doodle" style={{ top: 8, left: 22 }} />
          {rec ? (
            <div className="space-y-4">
              <h2 className="font-display font-extrabold text-2xl text-[var(--blue-bright)] text-center">Nice! What next?</h2>
              <div className="bg-white/70 rounded-xl px-4 border-2 border-dashed border-[rgba(18,49,92,.3)]">
                <FileRow rec={rec} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {CORE_TOOLS.map((t) => (
                  <Link key={t.key} to={`${t.to}?file=${rec.id}`} className={`btn ${t.key === 'compress' ? 'btn-yellow' : t.key === 'merge' ? 'btn-blue' : t.key === 'pages' ? 'btn-pink' : 'btn-mint'} w-full`}>
                    {t.title}
                  </Link>
                ))}
              </div>
              <Link to="/tools" className="btn btn-white btn-sm w-full">
                All 16 tools <ArrowRight size={16} />
              </Link>
              <button className="btn btn-white btn-sm w-full" onClick={() => setRec(null)}>
                Choose a different file
              </button>
            </div>
          ) : (
            <UploadBox onUploaded={setRec} />
          )}
          <ArrowCurve size={44} className="doodle hidden sm:block" style={{ bottom: 12, right: 10, color: 'var(--blue-bright)' }} />
        </section>
      </div>

      {/* tools */}
      <section className="mt-16 relative">
        <div className="absolute -top-7 left-6 sm:left-10 z-20"><SectionTitle>Our Tools</SectionTitle></div>
        <div className="paper torn-sheet rounded-md px-5 sm:px-8 py-8 pt-10 relative">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
            {CORE_TOOLS.map((t) => (
              <ToolCard key={t.key} tool={t} />
            ))}
          </div>

          <div className="mt-8 border-t-2 border-dashed border-[rgba(18,49,92,.25)] pt-5">
            <p className="font-display font-extrabold text-lg text-center">
              More tools <span className="font-hand text-[var(--ink-soft)] font-normal">— same paper, same privacy</span>
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {MORE_TOOLS.map((t) => (
                <Link key={t.key} to={t.to} className="btn btn-white btn-sm" title={t.desc}>
                  {t.title}
                </Link>
              ))}
            </div>
          </div>

          <p className="font-hand text-center text-[var(--ink-soft)] mt-6 text-lg">
            Core principle: <span className="mark-yellow font-display font-bold text-[var(--ink)]">Upload → Fix → Download.</span> That's it.
          </p>
        </div>
      </section>

      {/* privacy strip */}
      <section className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
        {[
          [<LockIcon size={30} key="l" />, 'Private by design', 'Your PDFs never leave your device — everything runs in your browser.'],
          [<ClockIcon size={30} key="c" />, 'Auto-delete', 'Files live in your browser for 24 hours, then disappear — no hoarded homework.'],
          [<BoltIcon size={30} key="b" />, 'Real processing', 'pdf.js, pdf-lib & Tesseract do the work — no fake buttons.'],
        ].map(([icon, title, desc], i) => (
          <div key={title as string} className={`paper rounded-2xl px-4 py-4 ${i === 2 ? 'rot-r1' : 'rot-l1'}`}>
            <p className="flex justify-center mb-1">{icon}</p>
            <p className="font-display font-extrabold text-lg">{title}</p>
            <p className="font-hand text-[var(--ink-soft)]">{desc}</p>
          </div>
        ))}
      </section>

      <div className="text-center mt-8">
        <button className="btn btn-orange btn-lg" onClick={() => navigate('/tools')}>
          See everything StudyPDF does <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
}
