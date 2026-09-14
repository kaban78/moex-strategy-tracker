'use client';

import { prefetchHistory } from '@/lib/moex/history-cache';

const PREFETCH_INTERVAL = 24;
const PREFETCH_DAYS = 3650;

interface Props {
  ticker: string;
  onClick: (ticker: string) => void;
}

export function TickerButton({ ticker, onClick }: Props) {
  function prefetch() {
    void prefetchHistory(ticker, PREFETCH_INTERVAL, PREFETCH_DAYS);
  }

  return (
    <button
      type="button"
      onClick={() => onClick(ticker)}
      onMouseEnter={prefetch}
      onFocus={prefetch}
      className="font-mono font-medium underline decoration-dotted underline-offset-4 hover:text-blue-500 transition-colors"
    >
      {ticker}
    </button>
  );
}
