import React from 'react';
export { Books, Pencil, Smiley, Star } from './Doodles';

type P = React.SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' });

export const Heart = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 20s-7.5-4.7-9.3-9A5.2 5.2 0 0112 6.6 5.2 5.2 0 0121.3 11c-1.8 4.3-9.3 9-9.3 9z" fill="currentColor" />
  </svg>
);

export const MailIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" fill="#fff" stroke="currentColor" strokeWidth="2" />
    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinejoin="round" />
  </svg>
);
