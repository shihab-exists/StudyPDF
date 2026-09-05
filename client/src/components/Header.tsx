import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { FolderIcon, MenuIcon, MoonIcon, PdfDocIcon, SunIcon, UserIcon, XIcon } from './Doodles';
import { ABOUT } from '../config';

const nav = [
  { to: '/', label: 'Home' },
  { to: '/tools', label: 'Tools' },
  { to: '/about', label: 'About' },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('spdf-theme') === 'dark');
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('spdf-theme', dark ? 'dark' : 'light');
  }, [dark]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `font-display font-bold px-3 py-1.5 rounded-lg text-[1.05rem] transition-colors ${
      isActive ? 'nav-active text-[#c23a2b]' : 'text-[var(--ink)] hover:bg-[rgba(255,216,77,0.45)]'
    }`;

  return (
    <header className="sticky top-0 z-50 px-2 sm:px-4 pt-3">
      <div className="paper torn-strip max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-5">
        <Link to="/" className="flex items-center gap-2 shrink-0 wiggle" aria-label="StudyPDF home">
          <span className="sticker p-1.5 hidden xs:block sm:block">
            <PdfDocIcon size={30} />
          </span>
          <span className="font-display font-extrabold text-2xl sm:text-[1.7rem] leading-none sticker-outline">
            <span className="logo-study">Study</span>
            <span className="logo-pdf">PDF</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 mx-auto" aria-label="Main">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={linkCls}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 ml-auto md:ml-0">
          <Link to="/my-files" className="btn btn-yellow btn-sm" title="My Files">
            <FolderIcon size={18} />
            <span className="hidden sm:inline">My Files</span>
          </Link>
          <div className="relative" ref={menuRef}>
            <button className="icon-btn" onClick={() => setMenu((m) => !m)} aria-label="Profile menu" aria-expanded={menu} style={{ padding: 0, overflow: 'hidden' }}>
              <img src={ABOUT.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
            </button>
            {menu && (
              <div className="absolute right-0 mt-2 w-52 paper rounded-2xl p-2 z-50 shadow-xl" style={{ boxShadow: '0 12px 30px rgba(4,22,58,.4)' }}>
                <button className="w-full text-left px-3 py-2 rounded-xl hover:bg-[rgba(255,216,77,.5)] flex items-center gap-2" onClick={() => { setDark((d) => !d); setMenu(false); }}>
                  {dark ? <SunIcon size={18} /> : <MoonIcon size={18} />}
                  <span className="font-display font-bold">{dark ? 'Light mode' : 'Dark mode'}</span>
                </button>
                <button className="w-full text-left px-3 py-2 rounded-xl hover:bg-[rgba(255,216,77,.5)] flex items-center gap-2" onClick={() => { setMenu(false); navigate('/my-files'); }}>
                  <FolderIcon size={18} />
                  <span className="font-display font-bold">My Files</span>
                </button>
                <button className="w-full text-left px-3 py-2 rounded-xl hover:bg-[rgba(255,216,77,.5)] flex items-center gap-2" onClick={() => { setMenu(false); navigate('/about'); }}>
                  <UserIcon size={18} />
                  <span className="font-display font-bold">About me</span>
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
            {open ? <XIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden paper torn-sheet max-w-6xl mx-auto mt-1 px-6 py-4 flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} onClick={() => setOpen(false)} className={linkCls}>
              {n.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
