'use client';

import { usePathname } from 'next/navigation';
import { format, startOfWeek, addDays } from 'date-fns';

interface TopBarProps {
  // Optional slot for right-side contextual content per page
  right?: React.ReactNode;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/log':       'Log',
  '/analytics': 'Analytics',
  '/settings':  'Settings',
};

export default function TopBar({ right }: TopBarProps) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? 'LifeChrono';

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between h-14 px-6"
      style={{
        backgroundColor: 'rgba(8, 8, 15, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1A1A2E',
      }}
    >
      <h1
        className="text-base font-semibold"
        style={{ color: '#F1F0FF' }}
      >
        {title}
      </h1>

      {right && (
        <div className="flex items-center gap-3">
          {right}
        </div>
      )}
    </header>
  );
}