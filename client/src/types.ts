export interface FileRecord {
  id: string;
  originalName: string;
  sizeBytes: number;
  pages: number;
  kind: 'upload' | 'result';
  tool: string;
  createdAt: number; // epoch ms
  when?: string; // human label, computed on read
}

export interface Analysis {
  pages: number;
  searchable: boolean;
  textChars: number;
  rotatedPages: number;
  scanQuality: 'Low' | 'Medium' | 'Good';
  hasImages: boolean;
  estimatedDpi: number | null;
}

/**
 * One page inside a page-preview grid / page-operation state.
 * `file` indexes into the grid's `sources` array (usually 0 — a single PDF),
 * `src` is the 1-based page number in that source, `rotate` is EXTRA rotation
 * (deg) the user asked for; it is applied to the final PDF, never just visually.
 */
export interface GridPage {
  file: number;
  src: number;
  rotate: number;
}

export type ToolKey =
  | 'compress' | 'merge' | 'split' | 'pages' | 'rotate'
  | 'numbers' | 'watermark' | 'protect'
  | 'to-images' | 'from-images' | 'to-word' | 'to-pptx' | 'to-excel'
  | 'ocr' | 'text' | 'info';
