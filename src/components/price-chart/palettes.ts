// language: TypeScript, target: chart color palettes

export interface ChartPalette {
  bg: string;
  fg: string;
  border: string;
  grid: string;
  up: string;
  down: string;
  crosshairLabel: string;
}

export const CHART_PALETTES: Record<'dark' | 'light', ChartPalette> = {
  dark: {

    bg: '#1e1e1e',
    fg: '#e5e5e5',
    border: '#4a4a4a',
    grid: '#333333',
    up: '#22c55e',
    down: '#ef4444',
    crosshairLabel: '#5a5a5a',
  },
  light: {
    bg: '#ffffff',
    fg: '#171717',
    border: '#d4d4d4',
    grid: '#f0f0f0',
    up: '#16a34a',
    down: '#dc2626',
    crosshairLabel: '#a3a3a3',
  },
};
