import React from 'react';
import { ABOUT } from '../config';
import { SectionTitle } from '../components/Bits';
import { Books, Heart, MailIcon, Pencil, Smiley, Star } from '../components/DoodlesAbout';
import { WhatsAppIcon } from '../components/DoodlesExtra';

export default function About() {
  return (
    <div className="relative max-w-3xl mx-auto">
      <Star size={30} className="doodle floaty" style={{ top: -14, right: -8, ['--fr' as string]: '10deg' }} />
      <div className="paper torn-sheet holes rounded-md px-7 sm:px-12 py-9 pl-11 sm:pl-16 relative ruled">
        <span className="tape t-center" />
        <SectionTitle color="var(--blue-bright)">About StudyPDF</SectionTitle>

        <blockquote className="font-hand text-xl text-[var(--ink)] border-l-4 border-[var(--yellow)] pl-4 my-4">
          StudyPDF is a simple PDF utility built to make everyday PDF tasks easier for students.
          Compress that too-big assignment, merge the twelve part-files of a lecture pack,
          fix a crooked scan — in minutes, not evenings.
        </blockquote>

        {/* built by — with profile photo */}
        <div className="note note-yellow rounded-md p-5 sm:p-6 rot-l1 mt-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <span className="tape t-pink t-center" />
          <span className="relative shrink-0">
            <img
              src={ABOUT.aboutImage}
              alt={`Profile photo of ${ABOUT.authorName}`}
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-white"
              style={{ boxShadow: '0 0 0 4px var(--orange), 0 10px 22px rgba(4,22,58,.35)' }}
            />
            <Smiley size={30} className="absolute -bottom-1 -right-2" />
          </span>
          <span className="flex-1">
            <p className="font-display font-extrabold text-lg text-[#c23a2b]">Built by</p>
            <p className="font-display font-extrabold text-2xl sm:text-3xl leading-tight mt-0.5">{ABOUT.authorName}</p>
            <p className="font-hand text-lg text-[var(--ink-soft)]">{ABOUT.authorRole}</p>
            <p className="font-hand text-[var(--ink-soft)] mt-2 flex items-center justify-center sm:justify-start gap-2">
              <Pencil size={18} /> designs it, builds it, ships it — between lectures
            </p>
          </span>
        </div>

        {/* contact */}
        <div className="note note-cyan rounded-md p-5 sm:p-6 rot-r1 mt-5">
          <span className="tape t-mint t-center" />
          <p className="font-display font-extrabold text-lg text-[#1c4fa3]">Contact</p>
          <div className="flex flex-wrap gap-3 mt-3">
            <a className="btn btn-yellow btn-sm" href={`mailto:${ABOUT.email}`}>
              <MailIcon size={18} /> {ABOUT.email}
            </a>
            <a className="btn btn-mint btn-sm" href={ABOUT.whatsapp} target="_blank" rel="noreferrer">
              <WhatsAppIcon size={18} /> WhatsApp me
            </a>
          </div>
          {ABOUT.showPhone && (
            <p className="font-hand text-sm text-[var(--ink-soft)] mt-3">
              Phone / WhatsApp: {ABOUT.phoneDisplay} · Email is still the fastest way to reach me.
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="font-hand text-xl">Found a problem or have a suggestion?</p>
          <a className="btn btn-red btn-lg mt-2" href={`mailto:${ABOUT.email}?subject=StudyPDF%20feedback`}>
            Contact Me →
          </a>
        </div>

        <div className="mt-10 flex items-center justify-center gap-3">
          <Books size={34} />
          <p className="font-script text-3xl text-[var(--blue-bright)] rotate-[-2deg]">{ABOUT.note}</p>
          <Smiley size={30} />
        </div>
        <p className="text-center font-hand text-[var(--ink-soft)] mt-2 flex items-center justify-center gap-1">
          made with <Heart size={16} color="#ff5a4e" /> and too much coffee
        </p>
      </div>
    </div>
  );
}
