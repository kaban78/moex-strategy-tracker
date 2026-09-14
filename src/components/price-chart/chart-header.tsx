'use client';

import { moexIssueUrl } from '@/lib/moex/links';
import { formatRub } from '@/lib/format';
import type { ChartPalette } from './palettes';
import type { Hover, Quote } from './types';

interface Props {
  ticker: string;
  palette: ChartPalette;
  hover: Hover | null;
  quote: Quote | null;
  barCount: number;
  updatedAt: Date | null;
  onClose: () => void;
}

export function ChartHeader({
  ticker,
  palette,
  hover,
  quote,
  barCount,
  updatedAt,
  onClose,
}: Props) {
  const price = hover?.close ?? quote?.price ?? 0;
  const change = quote?.change ?? 0;
  const changeAbs = quote?.changeAbs ?? 0;

  return (
    <div
      className="flex items-baseline gap-4 flex-wrap px-4 py-3 border-b cursor-move shrink-0"
      style={{
        backgroundColor: palette.bg,
        borderBottomColor: palette.border,
        color: palette.fg,
      }}
    >
      <span className="font-mono text-xl" data-no-drag>
        {ticker}
      </span>

      {price > 0 && (
        <>
          <span className="text-base">{formatRub(price)}</span>
          <span
            className={
              'text-sm ' +
              (change >= 0 ? 'text-green-500' : 'text-red-500')
            }
          >
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}% ({change >= 0 ? '+' : ''}
            {formatRub(changeAbs)})
          </span>
        </>
      )}

      {hover && (
        <span className="text-xs" style={{ color: palette.crosshairLabel }}>
          O {formatRub(hover.open)} · H {formatRub(hover.high)} · L{' '}
          {formatRub(hover.low)} · C {formatRub(hover.close)}
        </span>
      )}

      <div className="ml-auto flex gap-3 items-center">
        {updatedAt && (
          <span className="text-xs" style={{ color: palette.crosshairLabel }}>
            {barCount} бар ·{' '}
            {updatedAt.toLocaleTimeString('ru-RU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        )}
        <a
          href={moexIssueUrl(ticker)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline decoration-dotted underline-offset-4 hover:text-blue-500"
          style={{ color: palette.crosshairLabel }}
          data-no-drag
        >
          MOEX →
        </a>
        <button
          type="button"
          data-no-drag
          onClick={onClose}
          className="text-2xl leading-none px-2 -mt-1 opacity-70 hover:opacity-100"
          style={{ color: palette.fg }}
          aria-label="закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}
