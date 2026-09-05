import React from 'react';
import { Lightbulb, Smiley, Star, StarPink } from './Doodles';
import { FILE_TTL_HOURS } from '../config';

export default function Footer() {
  return (
    <footer className="relative mt-14 pb-8 px-3">
      <StarPink size={30} className="doodle floaty" style={{ left: '12%', bottom: 30, ['--fr' as string]: '-8deg' }} />
      <Star size={30} className="doodle floaty" style={{ right: '10%', bottom: 24, ['--fr' as string]: '10deg' }} />
      <div className="paper torn-strip max-w-3xl mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[1.12rem]">
        <Lightbulb size={26} />
        <span className="font-display font-bold">Study Smart</span>
        <span className="text-[var(--blue-bright)]">•</span>
        <span className="font-display font-bold">Save Time</span>
        <span className="text-[var(--blue-bright)]">•</span>
        <span className="font-display font-bold">Achieve More</span>
        <Smiley size={24} />
      </div>
      <p className="text-center text-white/80 font-hand mt-4 text-sm max-w-xl mx-auto">
        Your files never leave your device — they live in your browser and are automatically deleted after {FILE_TTL_HOURS} hours. Nothing is kept forever. 💙
      </p>
    </footer>
  );
}
