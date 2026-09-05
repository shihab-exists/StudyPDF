import React, { useRef, useState } from 'react';
import { GripIcon, TrashIcon, UploadIcon } from './Doodles';
import { formatBytes } from '../services/store';
import { useToast } from './Toasts';

export interface ImageItem {
  id: string;
  name: string;
  size: number;
  url: string; // object URL for preview
  file: File;
}

const MAX_IMAGES = 40;
const MAX_IMAGE_MB = 25;

function isImage(f: File): boolean {
  return f.type === 'image/png' || f.type === 'image/jpeg' || /\.(png|jpe?g)$/i.test(f.name);
}

/**
 * Multi-image picker for Images → PDF: drag & drop, previews, reorder
 * (drag rows or arrows) and remove. Everything stays local.
 */
export default function ImageDropList({ items, setItems }: { items: ImageItem[]; setItems: React.Dispatch<React.SetStateAction<ImageItem[]>> }) {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragIndex = useRef<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const add = (list: FileList | File[]) => {
    setError(null);
    const arr = [...list];
    const accepted: ImageItem[] = [];
    for (const f of arr) {
      if (!isImage(f)) {
        setError(`❌ "${f.name}" skipped — only JPG and PNG images are supported.`);
        continue;
      }
      if (f.size > MAX_IMAGE_MB * 1024 * 1024) {
        setError(`❌ "${f.name}" skipped — larger than ${MAX_IMAGE_MB} MB.`);
        continue;
      }
      if (f.size === 0) {
        setError(`❌ "${f.name}" skipped — the file is empty.`);
        continue;
      }
      accepted.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: f.name, size: f.size, url: URL.createObjectURL(f), file: f });
    }
    setItems((cur) => {
      const next = [...cur, ...accepted];
      if (next.length > MAX_IMAGES) {
        setError(`Only the first ${MAX_IMAGES} images are kept.`);
        return next.slice(0, MAX_IMAGES);
      }
      return next;
    });
    if (accepted.length) toast(`✓ Added ${accepted.length} image${accepted.length === 1 ? '' : 's'}`, 'ok');
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems((cur) => {
      const next = [...cur];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });
  };

  const remove = (id: string) => {
    setItems((cur) => {
      const target = cur.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return cur.filter((i) => i.id !== id);
    });
  };

  return (
    <div>
      <div
        className={`dropzone ${drag ? 'drag' : ''} text-center px-4 py-6`}
        role="button"
        tabIndex={0}
        aria-label="Add images"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) add(e.dataTransfer.files);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) add(e.target.files);
            e.target.value = '';
          }}
        />
        <p className="font-display font-extrabold text-xl text-[var(--blue-bright)] flex items-center justify-center gap-2">
          <UploadIcon size={22} /> Add JPG / PNG images
        </p>
        <p className="font-hand text-[var(--ink-soft)]">click or drop images here · they become pages in order</p>
      </div>
      {error && <p className="font-hand text-[#c23a2b] mt-2">{error}</p>}

      {items.length > 0 && (
        <ol className="list-none m-0 p-0 mt-5 space-y-2" aria-label="Selected images">
          {items.map((im, i) => (
            <li
              key={im.id}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDragLeave={() => setOverIndex((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex.current !== null) move(dragIndex.current, i);
                dragIndex.current = null;
                setOverIndex(null);
              }}
              onDragEnd={() => setOverIndex(null)}
              className={`flex items-center gap-3 bg-white/80 rounded-xl px-3 py-2 cursor-grab active:cursor-grabbing transition-shadow ${
                overIndex === i ? 'outline outline-3 outline-[var(--mint)]' : ''
              }`}
            >
              <GripIcon size={20} color="#9aa9c4" />
              <span className="font-display font-extrabold text-lg text-white bg-[var(--blue-bright)] rounded-lg w-9 h-9 flex items-center justify-center shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
              <img src={im.url} alt={im.name} className="w-14 h-14 object-cover rounded-lg border-2 border-[rgba(18,49,92,.25)] bg-white shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold truncate">{im.name}</p>
                <p className="font-hand text-sm text-[var(--ink-soft)]">{formatBytes(im.size)}</p>
              </div>
              <span className="flex gap-1">
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => move(i, i - 1)} aria-label="Move up" disabled={i === 0}>↑</button>
                <button className="icon-btn" style={{ width: 34, height: 34 }} onClick={() => move(i, i + 1)} aria-label="Move down" disabled={i === items.length - 1}>↓</button>
                <button className="icon-btn" style={{ width: 34, height: 34, color: '#c23a2b' }} onClick={() => remove(im.id)} aria-label={`Remove ${im.name}`}>
                  <TrashIcon size={16} />
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
