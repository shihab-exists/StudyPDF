import React from 'react';
import { Link } from 'react-router-dom';
import { ScribbleStar } from '../components/Doodles';

export default function NotFound() {
  return (
    <div className="paper torn-sheet rounded-md max-w-md mx-auto p-10 text-center relative">
      <ScribbleStar size={30} className="doodle" style={{ top: 14, right: 18, color: 'var(--blue-bright)' }} />
      <p className="font-display font-extrabold text-6xl text-[var(--orange)] sticker-outline">404</p>
      <h1 className="font-display font-extrabold text-2xl mt-2">Page not found</h1>
      <p className="font-hand text-lg text-[var(--ink-soft)] mt-1">This sheet fell out of the scrapbook.</p>
      <Link to="/" className="btn btn-yellow mt-5">← Back to Home</Link>
    </div>
  );
}
