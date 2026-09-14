// language: TypeScript, target: chart types

export interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Hover {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface Quote {
  price: number;
  change: number;
  changeAbs: number;
}
