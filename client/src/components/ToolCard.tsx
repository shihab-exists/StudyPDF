import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CompressIcon, MergeIcon, OcrIcon, PagesIcon,
  SplitIcon, RotateAllIcon, NumbersIcon, WatermarkIcon, ProtectIcon,
  ToImagesIcon, FromImagesIcon, TextIcon, ToolInfoIcon, WordDocIcon, SlidesIcon, ExcelIcon,
} from './Doodles';

export type ToolCategory = 'organize' | 'edit' | 'convert' | 'inspect';

export interface ToolMeta {
  key: string;
  title: string;
  desc: string;
  to: string;
  note: string;
  tape: string;
  tapeStyle?: React.CSSProperties;
  heading: string;
  rot: string;
  icon: (p: { size?: number }) => React.ReactElement;
  category: ToolCategory;
  core?: boolean;
}

export const TOOLS: ToolMeta[] = [
  {
    key: 'compress',
    title: 'Compress PDF',
    desc: 'Make your PDF smaller without losing quality.',
    to: '/compress',
    note: 'note-yellow',
    tape: 't-pink t-center',
    heading: '#d63f2c',
    rot: 'rot-l1',
    icon: (p) => <CompressIcon {...p} />,
    category: 'organize',
    core: true,
  },
  {
    key: 'merge',
    title: 'Merge PDFs',
    desc: 'Combine multiple PDFs into one file.',
    to: '/merge',
    note: 'note-cyan',
    tape: 't-mint t-center',
    heading: '#1c4fa3',
    rot: 'rot-r1',
    icon: (p) => <MergeIcon {...p} />,
    category: 'organize',
    core: true,
  },
  {
    key: 'split',
    title: 'Split PDF',
    desc: 'Break a PDF into parts, ranges or single pages.',
    to: '/split',
    note: 'note-mint',
    tape: '',
    heading: '#0d6b4e',
    rot: 'rot-l1',
    icon: (p) => <SplitIcon {...p} />,
    category: 'organize',
  },
  {
    key: 'pages',
    title: 'Page Manager',
    desc: 'Reorder, rotate, delete and extract pages.',
    to: '/pages',
    note: 'note-pink',
    tape: 't-cyan t-left',
    tapeStyle: { top: -12, left: '38%' },
    heading: '#d63f2c',
    rot: 'rot-l1',
    icon: (p) => <PagesIcon {...p} />,
    category: 'organize',
    core: true,
  },
  {
    key: 'rotate',
    title: 'Rotate All Pages',
    desc: 'Rotate every page 90°, 180° or 270° in one click.',
    to: '/rotate',
    note: 'note-yellow',
    tape: 't-right',
    heading: '#1c4fa3',
    rot: 'rot-r1',
    icon: (p) => <RotateAllIcon {...p} />,
    category: 'organize',
  },
  {
    key: 'numbers',
    title: 'Add Page Numbers',
    desc: 'Stamp tidy page numbers on every page.',
    to: '/numbers',
    note: 'note-cyan',
    tape: '',
    heading: '#b07800',
    rot: 'rot-r1',
    icon: (p) => <NumbersIcon {...p} />,
    category: 'edit',
  },
  {
    key: 'watermark',
    title: 'Watermark PDF',
    desc: 'Add DRAFT or CONFIDENTIAL text across your pages.',
    to: '/watermark',
    note: 'note-pink',
    tape: 't-mint t-center',
    heading: '#d96a90',
    rot: 'rot-l1',
    icon: (p) => <WatermarkIcon {...p} />,
    category: 'edit',
  },
  {
    key: 'to-word',
    title: 'PDF to Word',
    desc: 'Convert PDF files into editable Word documents.',
    to: '/to-word',
    note: 'note-cyan',
    tape: 't-pink t-center',
    heading: '#1c4fa3',
    rot: 'rot-l1',
    icon: (p) => <WordDocIcon {...p} />,
    category: 'convert',
  },
  {
    key: 'to-pptx',
    title: 'PDF to PowerPoint',
    desc: 'Turn PDF pages into PowerPoint slides.',
    to: '/to-pptx',
    note: 'note-yellow',
    tape: 't-mint t-center',
    heading: '#d63f2c',
    rot: 'rot-r1',
    icon: (p) => <SlidesIcon {...p} />,
    category: 'convert',
  },
  {
    key: 'to-excel',
    title: 'PDF to Excel',
    desc: 'Convert PDF tables into editable Excel spreadsheets.',
    to: '/to-excel',
    note: 'note-mint',
    tape: 't-cyan t-center',
    heading: '#0e7a3d',
    rot: 'rot-l1',
    icon: (p) => <ExcelIcon {...p} />,
    category: 'convert',
  },
  {
    key: 'protect',
    title: 'Protect PDF',
    desc: 'Real AES-256 password encryption for your file.',
    to: '/protect',
    note: 'note-mint',
    tape: 't-pink t-center',
    heading: '#0d6b4e',
    rot: 'rot-r1',
    icon: (p) => <ProtectIcon {...p} />,
    category: 'edit',
  },
  {
    key: 'to-images',
    title: 'PDF to Images',
    desc: 'Export every page as PNG or JPG.',
    to: '/to-images',
    note: 'note-yellow',
    tape: '',
    heading: '#1c4fa3',
    rot: 'rot-l1',
    icon: (p) => <ToImagesIcon {...p} />,
    category: 'convert',
  },
  {
    key: 'from-images',
    title: 'Images to PDF',
    desc: 'Combine JPG and PNG images into one PDF.',
    to: '/from-images',
    note: 'note-cyan',
    tape: 't-right',
    heading: '#d63f2c',
    rot: 'rot-r1',
    icon: (p) => <FromImagesIcon {...p} />,
    category: 'convert',
  },
  {
    key: 'ocr',
    title: 'OCR & Enhance',
    desc: 'Turn scanned PDFs into searchable and clear files.',
    to: '/ocr',
    note: 'note-mint',
    tape: 't-right',
    heading: '#0d6b4e',
    rot: 'rot-r1',
    icon: (p) => <OcrIcon {...p} />,
    category: 'inspect',
    core: true,
  },
  {
    key: 'text',
    title: 'Extract Text',
    desc: 'Pull the selectable text out into a .txt file.',
    to: '/text',
    note: 'note-pink',
    tape: '',
    heading: '#b07800',
    rot: 'rot-l1',
    icon: (p) => <TextIcon {...p} />,
    category: 'inspect',
  },
  {
    key: 'info',
    title: 'PDF Info',
    desc: 'Peek at metadata, page sizes and scan status.',
    to: '/info',
    note: 'note-yellow',
    tape: 't-cyan t-center',
    heading: '#1c4fa3',
    rot: 'rot-r1',
    icon: (p) => <ToolInfoIcon {...p} />,
    category: 'inspect',
  },
];

export const CORE_TOOLS = TOOLS.filter((t) => t.core);
export const MORE_TOOLS = TOOLS.filter((t) => !t.core);

export const CATEGORY_TITLE: Record<ToolCategory, string> = {
  organize: 'Organize PDF',
  edit: 'Edit & Customize',
  convert: 'Convert',
  inspect: 'Extract & Inspect',
};

export const CATEGORY_ORDER: ToolCategory[] = ['organize', 'edit', 'convert', 'inspect'];

export default function ToolCard({ tool, big }: { tool: ToolMeta; big?: boolean }) {
  const Icon = tool.icon;
  // The WHOLE card is the link (keyboard + touch friendly); the arrow stays as
  // a visual affordance with a generous hit area, not the only click target.
  return (
    <Link
      to={tool.to}
      aria-label={`Open ${tool.title}`}
      className={`note ${tool.note} ${tool.rot} rounded-md p-5 ${big ? 'min-h-[240px]' : ''} flex flex-col transition-transform hover:scale-[1.03] hover:rotate-0 duration-200 no-underline focus-visible:outline focus-visible:outline-3 focus-visible:outline-[var(--orange)] focus-visible:outline-offset-2`}
    >
      {tool.tape && <span className={`tape ${tool.tape}`} style={tool.tapeStyle} />}
      <div className="flex justify-center mb-2">
        <Icon size={big ? 74 : 62} />
      </div>
      <h3 className="font-display font-extrabold text-center text-xl sm:text-2xl sticker-outline" style={{ color: tool.heading }}>
        {tool.title}
      </h3>
      <p className="font-hand text-center text-[1.02rem] text-[var(--ink)] mt-1 mb-4">{tool.desc}</p>
      <div className="mt-auto flex justify-end">
        <span
          aria-hidden="true"
          className="btn btn-white btn-sm pointer-events-none flex items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <ArrowRight size={18} color={tool.heading} />
        </span>
      </div>
    </Link>
  );
}
