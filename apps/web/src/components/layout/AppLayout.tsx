'use client';

import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { SidebarProvider, useSidebar } from './SidebarContext';

const pageVariants = {
  initial: { opacity: 0, y: 8  },
  animate: { opacity: 1, y: 0  },
  exit:    { opacity: 0, y: -4 },
};

const pageTransition = {
  duration: 0.2,
  ease: 'easeOut' as const,
};

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed } = useSidebar();

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#08080F' }}>
      <Navbar />

      <div
        className="flex-1 min-w-0 transition-all duration-300 flex flex-col"
        style={{
          // Desktop: offset for sidebar. Mobile: no offset.
          marginLeft: 0,
        }}
      >
        {/* Sidebar offset — desktop only */}
        <style>{`
          @media (min-width: 768px) {
            #main-wrapper {
              margin-left: ${collapsed ? '64px' : '224px'};
            }
          }
        `}</style>

        <div id="main-wrapper" className="flex-1 flex flex-col transition-all duration-300">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
              className="flex-1"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </SidebarProvider>
  );
}