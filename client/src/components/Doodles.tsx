import React from 'react';

type P = React.SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' });

export const Star = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.6l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.4l-5.6 3.2 1.3-6.2L3 9.1l6.3-.7L12 2.6z" fill="#ffd84d" stroke="#e5a800" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const StarPink = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.6l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.4l-5.6 3.2 1.3-6.2L3 9.1l6.3-.7L12 2.6z" fill="#ff8fb3" stroke="#d96a90" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const Sparkle = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const ScribbleStar = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3l1.8 6.2L20 7l-4.4 5 4.4 5-6.2-2.2L12 21l-1.8-6.2L4 17l4.4-5L4 7l6.2 2.2L12 3z" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
  </svg>
);

export const Paperclip = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8.5 12.5l6-6a3.2 3.2 0 014.5 4.5l-7.8 7.8a5.3 5.3 0 01-7.5-7.5l7.4-7.4" stroke="#e0442e" strokeWidth="2.2" strokeLinecap="round" fill="none" />
  </svg>
);

export const Crown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 18h16l1.4-9-5 3.4L12 5l-4.4 7.4-5-3.4L4 18z" fill="#ffd84d" stroke="#e5a800" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const Lightbulb = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3a6 6 0 00-3.6 10.8c.8.6 1.1 1.4 1.2 2.2h4.8c.1-.8.4-1.6 1.2-2.2A6 6 0 0012 3z" fill="#ffd84d" stroke="#12315c" strokeWidth="1.7" />
    <path d="M10 19h4M10.6 21.4h2.8" stroke="#12315c" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export const Smiley = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.6" fill="#8ee08a" stroke="#12315c" strokeWidth="1.7" />
    <circle cx="9" cy="10.4" r="1.2" fill="#12315c" />
    <circle cx="15" cy="10.4" r="1.2" fill="#12315c" />
    <path d="M8.6 14.2c1 1.4 2.2 2 3.4 2s2.4-.6 3.4-2" stroke="#12315c" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    <circle cx="7.4" cy="13" r="1.3" fill="#ff8fb3" opacity=".8" />
  </svg>
);

export const ArrowCurve = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 18c6 1 11-2 14-9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" strokeDasharray="1 4" />
    <path d="M14.5 8.6L18.4 8l.4 4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const ArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 12h14M13 6.5L18.8 12 13 17.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Pencil = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 20l1.2-4.2L16.4 4.6a2 2 0 012.8 0l.2.2a2 2 0 010 2.8L8.2 18.8 4 20z" fill="#ffd84d" stroke="#12315c" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M15 6l3 3" stroke="#12315c" strokeWidth="1.6" />
    <path d="M4 20l1.2-4.2 3 3L4 20z" fill="#f6b09a" stroke="#12315c" strokeWidth="1.4" />
  </svg>
);

export const Books = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="14" width="18" height="5" rx="1.4" fill="#2f73d9" stroke="#12315c" strokeWidth="1.6" />
    <rect x="4.5" y="9" width="15" height="5" rx="1.4" fill="#ff5a4e" stroke="#12315c" strokeWidth="1.6" />
    <rect x="6" y="4" width="12" height="5" rx="1.4" fill="#2eb884" stroke="#12315c" strokeWidth="1.6" />
  </svg>
);

/* ------------------------------- tool icons ------------------------------- */
export const PdfDocIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M12 4h17l9 9v31H12V4z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M29 4v9h9" fill="none" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M18 15h6M18 20h8" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
    <rect x="8" y="24" width="22" height="12" rx="3" fill="#ff5a4e" stroke="#12315c" strokeWidth="2.6" />
    <text x="19" y="33.4" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="8.6" fill="#fff">PDF</text>
  </svg>
);

export const CompressIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M14 6h14l8 8v10H14V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <rect x="9" y="20" width="20" height="11" rx="3" fill="#ff5a4e" stroke="#12315c" strokeWidth="2.6" />
    <text x="19" y="28.6" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="8" fill="#fff">PDF</text>
    <path d="M24 35v6M20 38.4l4 3.6 4-3.6" stroke="#12315c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M38 30h4M40 26v8" stroke="#2f73d9" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const MergeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M6 8h13v18H6V8z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M29 8h13v18H29V8z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M10 13h5M10 17h5M33 13h5M33 17h5" stroke="#8ba3c7" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 20v8M20 24h8" stroke="#12315c" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M12 30c0 6 5 8 12 8s12-2 12-8" fill="none" stroke="#12315c" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const PagesIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <rect x="5" y="10" width="11" height="15" rx="2" fill="#8ddcf2" stroke="#12315c" strokeWidth="2.6" transform="rotate(-8 10 17)" />
    <rect x="18.5" y="8" width="11" height="15" rx="2" fill="#ffd84d" stroke="#12315c" strokeWidth="2.6" />
    <rect x="32" y="10" width="11" height="15" rx="2" fill="#fff" stroke="#12315c" strokeWidth="2.6" transform="rotate(8 37 17)" />
    <text x="24" y="18.6" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="8" fill="#12315c">2</text>
    <text x="10.6" y="18.2" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="7" fill="#12315c" transform="rotate(-8 10 17)">1</text>
    <text x="37.6" y="18.2" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="7" fill="#12315c" transform="rotate(8 37 17)">3</text>
    <path d="M10 34h28M10 39h20" stroke="#12315c" strokeWidth="2.6" strokeLinecap="round" strokeDasharray="4 3" />
  </svg>
);

export const OcrIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v24H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M16 16h14M16 22h14M16 28h9" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="31" cy="31" r="7.4" fill="#8ddcf2" stroke="#12315c" strokeWidth="2.8" />
    <path d="M36.5 36.5L42 42" stroke="#12315c" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M28 31h6M31 28v6" stroke="#12315c" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ------------------------------- tool icons v3 ------------------------------ */

export const SplitIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M8 6h13v17H8V6z" fill="#ffd84d" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M27 25h13v17H27V25z" fill="#8ddcf2" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M11 11h7M11 15h7M30 30h7M30 34h7" stroke="#12315c" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
    <path d="M34 8L14 40" stroke="#ff5a4e" strokeWidth="3" strokeLinecap="round" strokeDasharray="5 4" />
  </svg>
);

export const RotateAllIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <rect x="12" y="8" width="22" height="28" rx="3" fill="#fff" stroke="#12315c" strokeWidth="3" transform="rotate(6 23 22)" />
    <path d="M17 16h12M17 22h12M17 28h7" stroke="#8ba3c7" strokeWidth="2.4" strokeLinecap="round" transform="rotate(6 23 22)" />
    <path d="M8 34a14 14 0 0 0 26 4" fill="none" stroke="#2f73d9" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M34 32l1 7-7-2" fill="#2f73d9" stroke="#2f73d9" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export const NumbersIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M16 15h14M16 21h14" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="24" cy="33" r="8" fill="#ffd84d" stroke="#12315c" strokeWidth="2.6" />
    <text x="24" y="36.4" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="9" fill="#12315c">7</text>
  </svg>
);

export const WatermarkIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M16 14h14M16 20h14M16 34h9" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
    <text x="24" y="29" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="9" fill="#ff8fb3" stroke="#d96a90" strokeWidth=".6" transform="rotate(-14 24 27)">DRAFT</text>
  </svg>
);

export const ProtectIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <rect x="17" y="22" width="14" height="12" rx="3" fill="#9be3c2" stroke="#12315c" strokeWidth="2.6" />
    <path d="M20 22v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#12315c" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="24" cy="28" r="1.8" fill="#12315c" />
    <path d="M16 13h12" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const ToImagesIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M8 8h15v19H8V8z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M12 14h7M12 19h7" stroke="#8ba3c7" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="24" y="18" width="18" height="14" rx="2.5" fill="#8ddcf2" stroke="#12315c" strokeWidth="2.8" transform="rotate(-5 33 25)" />
    <rect x="27" y="26" width="18" height="14" rx="2.5" fill="#ffd84d" stroke="#12315c" strokeWidth="2.8" transform="rotate(5 36 33)" />
    <path d="M31 35l3-3.4 2.4 2.4L40 30" fill="none" stroke="#12315c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" transform="rotate(5 36 33)" />
  </svg>
);

export const FromImagesIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <rect x="6" y="10" width="17" height="13" rx="2.5" fill="#ff8fb3" stroke="#12315c" strokeWidth="2.8" transform="rotate(-6 14 16)" />
    <rect x="6" y="26" width="17" height="13" rx="2.5" fill="#9be3c2" stroke="#12315c" strokeWidth="2.8" transform="rotate(5 14 32)" />
    <path d="M27 24h9M32 20l4 4-4 4" fill="none" stroke="#12315c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M37 8h5v32h-5" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <text x="39.5" y="27" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="7" fill="#ff5a4e" transform="rotate(90 39.5 24)">PDF</text>
  </svg>
);

export const WordDocIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M30 6v8h8" fill="none" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <text x="24" y="33" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="15" fill="#1c4fa3">W</text>
    <path d="M15 15h10" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const SlidesIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <rect x="7" y="9" width="34" height="24" rx="3" fill="#fff" stroke="#12315c" strokeWidth="3" />
    <path d="M24 33v6" stroke="#12315c" strokeWidth="3" strokeLinecap="round" />
    <path d="M16 41h16" stroke="#12315c" strokeWidth="3" strokeLinecap="round" />
    <rect x="12" y="14" width="12" height="7" rx="1.5" fill="#ff8fb3" stroke="#12315c" strokeWidth="2" />
    <path d="M28 27v-5M33 27v-9M38 27v-3" stroke="#2f73d9" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

export const ExcelIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M30 6v8h8" fill="none" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <path d="M15 20h18M15 27h18M15 34h18M24 20v14" stroke="#8ba3c7" strokeWidth="2.2" />
    <text x="19" y="33" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="16" fill="#0e7a3d">X</text>
  </svg>
);

export const TextIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <text x="24" y="30" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="16" fill="#2f73d9">T</text>
    <path d="M16 36h16" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const ToolInfoIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p} viewBox="0 0 48 48">
    <path d="M10 6h20l8 8v28H10V6z" fill="#fff" stroke="#12315c" strokeWidth="3" strokeLinejoin="round" />
    <circle cx="24" cy="26" r="9" fill="#ffd84d" stroke="#12315c" strokeWidth="2.6" />
    <text x="24" y="30.4" textAnchor="middle" fontFamily="Baloo 2, sans-serif" fontWeight="800" fontSize="11" fill="#12315c">i</text>
    <path d="M16 12h10" stroke="#8ba3c7" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

/* --------------------------------- ui icons -------------------------------- */
export const UploadIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 16V4M7.5 8.5L12 4l4.5 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const DownloadIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4v12M7.5 11.5L12 16l4.5-4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 15v3.5A1.5 1.5 0 005.5 20h13a1.5 1.5 0 001.5-1.5V15" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const FolderIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M3 6.5A1.5 1.5 0 014.5 5h4l2 2.5h9A1.5 1.5 0 0121 9v9.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5v-12z" fill="currentColor" />
  </svg>
);

export const UserIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="8.6" r="4" fill="currentColor" />
    <path d="M4.5 20c.8-4.2 3.9-6.2 7.5-6.2s6.7 2 7.5 6.2H4.5z" fill="currentColor" />
  </svg>
);

export const MenuIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const XIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);

export const CheckIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 12.5l5 5L19.5 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const TrashIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.8A1.3 1.3 0 0110.8 3.5h2.4a1.3 1.3 0 011.3 1.3v1.7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M6.5 6.5l1 13A1.6 1.6 0 009.1 21h5.8a1.6 1.6 0 001.6-1.5l1-13" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    <path d="M10 10.5v6M14 10.5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const RotateIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M19.5 12a7.5 7.5 0 11-2.2-5.3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
    <path d="M19.8 3.8v4.4h-4.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

export const EyeIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const GripIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="9" cy="6" r="1.7" fill="currentColor" /><circle cx="15" cy="6" r="1.7" fill="currentColor" />
    <circle cx="9" cy="12" r="1.7" fill="currentColor" /><circle cx="15" cy="12" r="1.7" fill="currentColor" />
    <circle cx="9" cy="18" r="1.7" fill="currentColor" /><circle cx="15" cy="18" r="1.7" fill="currentColor" />
  </svg>
);

export const MoonIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M19 14.5A8 8 0 019.5 5a8 8 0 108.4 11.4 8 8 0 011.1-1.9z" fill="currentColor" />
  </svg>
);

export const SunIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="4.4" fill="currentColor" />
    <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

export const WarnIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3.5L22 20H2L12 3.5z" fill="#ffd84d" stroke="#12315c" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 9.5v5" stroke="#12315c" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="12" cy="17" r="1.4" fill="#12315c" />
  </svg>
);

export const InfoIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="9" fill="currentColor" />
    <path d="M12 10.6v6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <circle cx="12" cy="7.4" r="1.5" fill="#fff" />
  </svg>
);
export const LockIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" fill="#ffd84d" stroke="#12315c" strokeWidth="1.8" />
    <path d="M8.2 10.5V8a3.8 3.8 0 017.6 0v2.5" stroke="#12315c" strokeWidth="1.8" fill="none" />
    <circle cx="12" cy="15" r="1.6" fill="#12315c" />
  </svg>
);

export const ClockIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="8.6" fill="#8ddcf2" stroke="#12315c" strokeWidth="1.8" />
    <path d="M12 7.4V12l3.2 2.4" stroke="#12315c" strokeWidth="1.9" strokeLinecap="round" fill="none" />
  </svg>
);

export const BoltIcon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M13.4 2.6L5.6 13.4h5l-1.4 8 8.2-11h-5.2l1.2-7.8z" fill="#ffd84d" stroke="#12315c" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
