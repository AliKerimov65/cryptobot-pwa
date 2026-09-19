import { NavLink } from 'react-router';
import { motion } from 'framer-motion';
import type { JSX } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
  end?: boolean;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Главная',
    end: true,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
    ),
  },
  {
    to: '/algotrading',
    label: 'AlgoTrading',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <rect x="6" y="6" width="12" height="12" rx="2" />
        <rect x="10" y="10" width="4" height="4" />
        <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
      </svg>
    ),
  },
  {
    to: '/bots',
    label: 'Боты',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M12 8V4M8 4h8" />
        <circle cx="9" cy="13" r="0.6" fill="currentColor" />
        <circle cx="15" cy="13" r="0.6" fill="currentColor" />
        <path d="M9 17h6" />
      </svg>
    ),
  },
  {
    to: '/acta',
    label: 'АЦТА',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <path d="M3 3v18h18" />
        <path d="M7 15v3M12 10v8M17 6v12" />
      </svg>
    ),
  },
  {
    to: '/bybit',
    label: 'Bybit',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <path d="m13 2-8 9h6l-2 11 8-11h-6l2-9Z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Настройки',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-subtle bg-[#0D1017]/90 backdrop-blur-md">
      <div className="mx-auto grid max-w-[1200px] grid-cols-6">
        {ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className="relative">
            {({ isActive }) => (
              <span
                className={cn(
                  'flex h-16 flex-col items-center justify-center gap-1 transition-colors',
                  isActive ? 'text-brand' : 'text-muted2 hover:text-primary2',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute top-0 h-0.5 w-10 rounded-full bg-brand"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                {item.icon}
                <span className="text-[10px] font-medium leading-none">{item.label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
