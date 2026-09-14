'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_DIMENSIONS, MIN_DIMENSIONS } from '../constants';

interface Position {
  x: number;
  y: number;
}

interface Dimensions {
  w: number;
  h: number;
}

interface Result {
  pos: Position;
  dim: Dimensions;
  reset: () => void;
  onPanelMouseDown: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Управляет положением и размером диалога.
 * - перетаскивание — за любую часть панели, кроме интерактивных элементов
 * - resize — за нижний правый уголок
 */
export function useWindowDrag(open: boolean): Result {
  const [pos, setPos] = useState<Position>({ x: 0, y: 0 });
  const [dim, setDim] = useState<Dimensions>({
    w: DEFAULT_DIMENSIONS.w,
    h: DEFAULT_DIMENSIONS.h,
  });
  const dragRef = useRef({ active: false, sx: 0, sy: 0, bx: 0, by: 0 });
  const resizeRef = useRef({ active: false, sx: 0, sy: 0, bw: 0, bh: 0 });

  useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onMove(e: MouseEvent) {
      if (dragRef.current.active) {
        const d = dragRef.current;
        setPos({
          x: d.bx + (e.clientX - d.sx),
          y: d.by + (e.clientY - d.sy),
        });
      } else if (resizeRef.current.active) {
        const r = resizeRef.current;
        setDim({
          w: Math.max(MIN_DIMENSIONS.w, r.bw + (e.clientX - r.sx)),
          h: Math.max(MIN_DIMENSIONS.h, r.bh + (e.clientY - r.sy)),
        });
      }
    }
    function onUp() {
      dragRef.current.active = false;
      resizeRef.current.active = false;
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [open]);

  function onPanelMouseDown(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('a, button, input, select, textarea, [data-no-drag]')) return;
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      bx: pos.x,
      by: pos.y,
    };
    document.body.style.userSelect = 'none';
  }

  function onResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      bw: dim.w,
      bh: dim.h,
    };
    document.body.style.userSelect = 'none';
  }

  function reset() {
    setPos({ x: 0, y: 0 });
  }

  return { pos, dim, reset, onPanelMouseDown, onResizeMouseDown };
}
