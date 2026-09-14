'use client';

import type { ChartPalette } from './palettes';

interface Props {
  palette: ChartPalette;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ChartResizeHandle({ palette, onMouseDown }: Props) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize group"
      aria-label="изменить размер"
    >
      <svg
        viewBox="0 0 20 20"
        className="w-full h-full group-hover:opacity-100 opacity-60"
        style={{ color: palette.fg }}
      >
        <line
          x1="6"
          y1="18"
          x2="18"
          y2="6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="12"
          y1="18"
          x2="18"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
