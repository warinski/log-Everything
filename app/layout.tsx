import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LoggerLogger',
  description: 'Flexible event and transaction logger with dynamic fields',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.className} h-full bg-gray-50`} suppressHydrationWarning>
      <body className="h-full antialiased text-gray-900">
        {children}
      </body>
    </html>
  );
}