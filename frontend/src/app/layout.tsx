import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClaudeIQ',
  description: 'ClaudeIQ for professional legal document analysis and review',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
