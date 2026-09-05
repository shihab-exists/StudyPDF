import React from 'react';
import ToolCard, { CATEGORY_ORDER, CATEGORY_TITLE, TOOLS } from '../components/ToolCard';
import { SectionTitle } from '../components/Bits';
import { Paperclip, Star } from '../components/Doodles';

const SECTION_COLOR: Record<string, string> = {
  organize: 'var(--orange)',
  edit: '#e0567f',
  convert: 'var(--blue-bright)',
  inspect: '#2eb884',
};

export default function Tools() {
  return (
    <div className="relative">
      <Star size={32} className="doodle floaty hidden md:block" style={{ top: -10, right: '-40px', ['--fr' as string]: '12deg' }} />
      <div className="paper torn-sheet rounded-md px-5 sm:px-9 py-9 relative">
        <span className="tape t-left" />
        <Paperclip size={30} className="doodle" style={{ top: -14, right: 40 }} />
        <SectionTitle>Our Tools</SectionTitle>
        <p className="font-hand text-xl text-[var(--ink-soft)] -mt-2 mb-7 max-w-2xl">
          Sixteen tools, zero clutter — all running privately in your browser. Pick one and go:{' '}
          <span className="mark-yellow font-display font-bold text-[var(--ink)]">Upload → Fix → Download.</span>
        </p>

        {CATEGORY_ORDER.map((cat) => (
          <section key={cat} className="mb-9 last:mb-0">
            <div className="mb-4">
              <span
                className="font-display font-extrabold text-lg text-white px-4 py-1.5 rounded-lg inline-block -rotate-1"
                style={{ background: SECTION_COLOR[cat], boxShadow: '0 0 0 4px #fff, 0 6px 14px rgba(4,22,58,.3)' }}
              >
                {CATEGORY_TITLE[cat]}
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {TOOLS.filter((t) => t.category === cat).map((t) => (
                <ToolCard key={t.key} tool={t} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
