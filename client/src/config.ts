/**
 * ✏️  Edit this file to personalise the About page.
 * These values are shown publicly — email is the primary contact method,
 * the phone number is only displayed as small secondary text.
 */
export const ABOUT = {
  appName: 'StudyPDF',
  tagline: 'Simple PDF tools for students.',
  authorName: 'Md Shibli Rahman Shihab',
  authorRole: 'Full Stack Developer & UI Designer',
  email: 'shihabmee26@gmail.com',
  phone: '+880 1309-225898', // shown small, never as a big public button
  phoneDisplay: '+880 1309-225898',
  phoneRaw: '01309225898',
  whatsapp: 'https://wa.me/8801309225898',
  showPhone: true,
  profileImage: '/profile.png', // header avatar (beside My Files) — keep as is
  aboutImage: '/about-photo.png', // photo shown on the About page
  note: 'Made for students, with students in mind.',
};

function envInt(name: string, fallback: number): number {
  const raw = (import.meta.env as Record<string, string | undefined>)[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const MAX_UPLOAD_MB = envInt('VITE_MAX_UPLOAD_MB', 100);
export const FILE_TTL_HOURS = envInt('VITE_FILE_TTL_HOURS', 24);
