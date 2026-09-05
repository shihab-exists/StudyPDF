/**
 * Centralised page-index / virtual-section math for StudyPDF.
 *
 * ONE original PDF of ANY page count (the only upload boundary is the 100 MB
 * file-size rule). For viewing/rendering we window the document into virtual
 * sections of SECTION_SIZE pages — a pure UI/rendering mechanism. Sections
 * never split the source PDF, never rename pages and never limit anything:
 * human page numbers stay absolute everywhere.
 */

export const SECTION_SIZE = 100;

/** How many virtual sections a document of `totalPages` pages needs. */
export function sectionCount(totalPages: number): number {
  if (!Number.isFinite(totalPages) || totalPages <= 0) return 0;
  return Math.ceil(totalPages / SECTION_SIZE);
}

/** 0-based section index that contains absolute human page `page` (1-based). */
export function sectionForPage(page: number): number {
  return Math.floor((page - 1) / SECTION_SIZE);
}

/** First absolute human page (1-based) of a 0-based section. */
export function sectionStart(section: number): number {
  return section * SECTION_SIZE + 1;
}

/** Last absolute human page of a 0-based section, clamped to the document. */
export function sectionEnd(section: number, totalPages: number): number {
  return Math.min(totalPages, (section + 1) * SECTION_SIZE);
}

/** [first, last] absolute human pages of a 0-based section. */
export function sectionRange(section: number, totalPages: number): [number, number] {
  return [sectionStart(section), sectionEnd(section, totalPages)];
}

/** Absolute 0-based array position of a human page within a page list. */
export function humanPageToPdfIndex(page: number): number {
  return page - 1;
}

/** Human page (1-based) for an absolute 0-based index. */
export function pdfIndexToHumanPage(index: number): number {
  return index + 1;
}

/** Clamp a requested page into 1..totalPages (jump input safety). */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, Math.round(page)), Math.max(1, totalPages));
}
