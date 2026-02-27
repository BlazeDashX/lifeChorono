'use client';

import Navbar from './Navbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
