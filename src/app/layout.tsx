import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import './globals.css';

export const metadata: Metadata = {
  title: 'MOEX Strategy Tracker',
  description:
    'Информационный инструмент для отслеживания портфеля относительно IMOEX',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://www.moex.com" />
        <link rel="dns-prefetch" href="https://www.moex.com" />
        <link rel="preconnect" href="https://iss.moex.com" />
        <link rel="dns-prefetch" href="https://iss.moex.com" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
