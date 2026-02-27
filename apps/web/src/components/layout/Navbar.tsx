'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth';
import {
  LayoutDashboard, BookOpen, BarChart2,
  Settings, LogOut, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import QuickAddModal from '@/components/QuickAddModal';
import { useSidebar } from './SidebarContext';
import Logo from '../logo';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/log',       label: 'Log',       icon: BookOpen        },
  { href: '/analytics', label: 'Analytics', icon: BarChart2       },
  { href: '/settings',  label: 'Settings',  icon: Settings        },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, accessToken, logout } = useAuthStore();
  const { collapsed, setCollapsed } = useSidebar();
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !accessToken) return null;

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <>
      {/* ── Desktop Sidebar ──────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col fixed left-0 top-0 h-full z-40 transition-all duration-300"
        style={{
          width: collapsed ? '64px' : '224px',
          backgroundColor: '#0F0F1A',
          borderRight: '1px solid #1A1A2E',
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center h-16 shrink-0"
          style={{
            borderBottom: '1px solid #1A1A2E',
            padding: collapsed ? '0' : '0 20px',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <Logo collapsed={collapsed} />
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5
                           transition-all duration-150 group relative"
                style={{
                  backgroundColor: isActive ? '#7C3AED' : 'transparent',
                  color: isActive ? '#ffffff' : '#9896B8',
                }}
                onMouseEnter={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = '#14142A';
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = '#F1F0FF';
                }}
                onMouseLeave={e => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  if (!isActive) (e.currentTarget as HTMLElement).style.color = '#9896B8';
                }}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium whitespace-nowrap">{label}</span>
                )}
                {/* Tooltip when collapsed */}
                {collapsed && (
                  <div
                    className="absolute left-14 text-xs px-2.5 py-1.5 rounded-lg
                               opacity-0 group-hover:opacity-100 pointer-events-none
                               transition-opacity whitespace-nowrap z-50"
                    style={{
                      backgroundColor: '#14142A',
                      border: '1px solid #1A1A2E',
                      color: '#F1F0FF',
                      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 pb-4 space-y-0.5" style={{ borderTop: '1px solid #1A1A2E', paddingTop: '8px' }}>
          {/* User info */}
          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'rgba(124,58,237,0.2)',
                  border: '1px solid rgba(124,58,237,0.3)',
                }}
              >
                <span className="text-xs font-bold" style={{ color: '#7C3AED' }}>
                  {user?.name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate" style={{ color: '#F1F0FF' }}>
                  {user?.name}
                </p>
                <p className="text-xs truncate" style={{ color: '#4A4A6A' }}>
                  {user?.email}
                </p>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5
                       transition-all duration-150 group relative"
            style={{ color: '#9896B8' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#f87171';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.05)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = '#9896B8';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="text-sm font-medium">Logout</span>}
            {collapsed && (
              <div
                className="absolute left-14 text-xs px-2.5 py-1.5 rounded-lg
                           opacity-0 group-hover:opacity-100 pointer-events-none
                           transition-opacity whitespace-nowrap z-50"
                style={{
                  backgroundColor: '#14142A',
                  border: '1px solid #1A1A2E',
                  color: '#F1F0FF',
                }}
              >
                Logout
              </div>
            )}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg
                       transition-all duration-150"
            style={{ color: '#4A4A6A' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.color = '#F1F0FF';
              (e.currentTarget as HTMLElement).style.backgroundColor = '#14142A';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.color = '#4A4A6A';
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft  className="w-4 h-4" />
            }
          </button>
        </div>
      </aside>

      {/* ── Mobile Bottom Tab Bar ────────────────────────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40"
        style={{
          backgroundColor: 'rgba(15,15,26,0.92)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid #1A1A2E',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            if (href === '/log') {
              return (
                <button
                  key="log-fab"
                  onClick={() => setIsModalOpen(true)}
                  className="flex flex-col items-center justify-center
                             -mt-5 w-14 h-14 rounded-full transition-transform
                             hover:scale-105 active:scale-95 duration-150"
                  style={{
                    backgroundColor: '#7C3AED',
                    boxShadow: '0 0 24px rgba(124,58,237,0.4)',
                  }}
                >
                  <Plus className="w-6 h-6 text-white" />
                </button>
              );
            }

            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg"
                style={{ color: isActive ? '#7C3AED' : '#4A4A6A' }}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <QuickAddModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={new Date()}
        prefillData={null}
      />
    </>
  );
}