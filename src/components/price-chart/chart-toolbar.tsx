'use client';

import { INTERVALS, RANGES } from './constants';
import type { ChartPalette } from './palettes';

interface Props {
  palette: ChartPalette;
  intervalValue: number;
  rangeDays: number;
  onIntervalChange: (v: number) => void;
  onRangeChange: (v: number) => void;
}

const CHIP_BASE = 'px-3 py-1 text-xs rounded-md border transition-colors';

function chipStyle(palette: ChartPalette, active: boolean): React.CSSProperties {
  return active
    ? {
        backgroundColor: palette.fg,
        color: palette.bg,
        borderColor: palette.fg,
      }
    : {
        backgroundColor: 'transparent',
        color: palette.fg,
        borderColor: palette.border,
      };
}

export function ChartToolbar({
  palette,
  intervalValue,
  rangeDays,
  onIntervalChange,
  onRangeChange,
}: Props) {
  const sectionStyle = {
    backgroundColor: palette.bg,
    borderBottomColor: palette.border,
  };

  return (
    <>
      <div
        className="flex gap-1 items-center flex-wrap px-4 py-2 border-b shrink-0"
        style={sectionStyle}
      >
        <span
          className="text-xs mr-2"
          style={{ color: palette.crosshairLabel }}
        >
          свечи:
        </span>
        {INTERVALS.map((i) => (
          <button
            key={i.value}
            type="button"
            data-no-drag
            onClick={() => onIntervalChange(i.value)}
            className={CHIP_BASE}
            style={chipStyle(palette, intervalValue === i.value)}
          >
            {i.label}
          </button>
        ))}
      </div>

      <div
        className="flex gap-1 items-center flex-wrap px-4 py-2 border-b shrink-0"
        style={sectionStyle}
      >
        <span
          className="text-xs mr-2"
          style={{ color: palette.crosshairLabel }}
        >
          период:
        </span>
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            data-no-drag
            onClick={() => onRangeChange(r.days)}
            className={CHIP_BASE}
            style={chipStyle(palette, rangeDays === r.days)}
          >
            {r.label}
          </button>
        ))}
        <span
          className="text-xs ml-auto"
          style={{ color: palette.crosshairLabel }}
        >
          колесо — зум · тяни — скролл · 2× клик — сброс
        </span>
      </div>
    </>
  );
}
