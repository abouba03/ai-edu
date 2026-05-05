'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { ModeToggle } from '@/components/theme-toggle';
import { usePathname } from 'next/navigation';
import {
  Trophy,
  Menu,
  X,
  User,
  LayoutDashboard,
  BookOpen,
  Sparkles,
  Shield,
  Bug,
  ChevronRight,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { useAuth } from '@clerk/nextjs';

interface MainLayoutProps {
  children: React.ReactNode;
  initialUser?: { name: string; level: string };
}

const NAV_MAIN = [
  {
    label: 'Главная',
    icon: LayoutDashboard,
    href: '/dashboard',
    match: (p: string) => p === '/dashboard' || p === '/',
  },
  {
    label: 'Курсы',
    icon: BookOpen,
    href: '/courses',
    match: (p: string) => p.startsWith('/courses'),
  },
  {
    label: 'Задания',
    icon: Trophy,
    href: '/challenges',
    match: (p: string) => p.startsWith('/challenges'),
  },
];

const NAV_TOOLS = [
  {
    label: 'ИИ-генератор',
    icon: Sparkles,
    href: '/generator',
    match: (p: string) => p.startsWith('/generator'),
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 text-sm font-bold border-2 transition-all duration-100',
        active
          ? 'bg-[#FDC800] border-[#1C293C] text-[#1C293C] shadow-[3px_3px_0px_0px_#1C293C]'
          : 'bg-white border-transparent text-[#1C293C]/70 hover:border-[#1C293C] hover:text-[#1C293C] hover:bg-[#FBFBF9]',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
      {active && <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-widest font-black text-[#432DD7] px-1 mb-1.5">
      {children}
    </p>
  );
}

function UserCard({ name, level, loaded }: { name: string; level: string; loaded?: boolean }) {
  return (
    <div className="border-2 border-[#1C293C] bg-white px-3 py-3 flex items-center gap-3 shadow-[3px_3px_0px_0px_#1C293C]">
      <div className="size-9 border-2 border-[#1C293C] bg-[#FDC800] flex items-center justify-center font-black text-sm text-[#1C293C] shrink-0 select-none">
        {name.slice(0, 2).toUpperCase()}
      </div>
      <div className="overflow-hidden">
        <p className="font-black text-sm text-[#1C293C] truncate">
          {name}
        </p>
        <p className="text-[11px] font-semibold text-[#1C293C]/55 truncate">
          Уровень: {level}
        </p>
      </div>
    </div>
  );
}

export default function MainLayout({ children, initialUser }: MainLayoutProps) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname();
  const isGeneratorFocusPage = pathname.startsWith('/generator/exercise') || pathname.startsWith('/generator/code');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userName = useMemo(() => initialUser?.name ?? 'Étudiant', [initialUser]);
  const userLevel = useMemo(() => initialUser?.level ?? 'débutant', [initialUser]);

  useEffect(() => {
    if (isSignedIn) fetch('/api/sync-user', { method: 'POST' });
  }, [isSignedIn]);

  const closeMenu = () => setIsMobileMenuOpen(false);

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <div className="flex flex-col flex-1 px-3 py-4 gap-5 overflow-auto">
      {/* Main nav */}
      <div>
        <SectionLabel>Меню</SectionLabel>
        <div className="space-y-1">
          {NAV_MAIN.map((r) => (
            <NavItem
              key={r.href}
              href={r.href}
              label={r.label}
              icon={r.icon}
              active={r.match(pathname)}
              onClick={onNav}
            />
          ))}
        </div>
      </div>

      {/* Tools nav */}
      <div>
        <SectionLabel>Инструменты ИИ</SectionLabel>
        <div className="space-y-1">
          {NAV_TOOLS.map((r) => (
            <NavItem
              key={r.href}
              href={r.href}
              label={r.label}
              icon={r.icon}
              active={r.match(pathname)}
              onClick={onNav}
            />
          ))}
        </div>
      </div>

      {/* Bottom */}
      <div className="mt-auto space-y-2">
        <Link
          href="/admin"
          onClick={onNav}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 text-sm font-bold border-2 transition-all duration-100',
            pathname.startsWith('/admin')
              ? 'bg-[#432DD7] border-[#1C293C] text-white shadow-[3px_3px_0px_0px_#1C293C]'
              : 'bg-white border-transparent text-[#1C293C]/70 hover:border-[#1C293C] hover:text-[#1C293C] hover:bg-[#FBFBF9]',
          )}
        >
          <Shield className="h-4 w-4 shrink-0" />
          Admin
          {pathname.startsWith('/admin') && <ChevronRight className="ml-auto h-3.5 w-3.5" />}
        </Link>

        <UserCard name={userName} level={userLevel} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-[#1C293C]">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 h-[60px] border-b-2 border-[#1C293C] bg-[#FBFBF9] flex items-center px-4 lg:px-6 justify-between gap-4">

        {/* Left: mobile trigger + logo */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          {!isGeneratorFocusPage && (
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  aria-label="Открыть меню"
                  className="lg:hidden border-2 border-[#1C293C] bg-white p-2 shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
                >
                  {isMobileMenuOpen ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Menu className="h-4 w-4" />
                  )}
                </button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="w-[280px] sm:w-[300px] rounded-none border-r-2 border-[#1C293C] bg-[#FBFBF9] p-0 flex flex-col"
              >
                <SheetHeader className="border-b-2 border-[#1C293C] px-5 py-4 shrink-0">
                  <SheetTitle className="text-left font-black text-[#1C293C]">
                    AI Edu<span className="text-[#432DD7]">.</span> — обучение
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col flex-1 overflow-hidden">
                  {/* Mobile user card */}
                  <div className="px-3 pt-4 pb-2 border-b-2 border-[#1C293C]/10">
                    <UserCard name={userName} level={userLevel} />
                  </div>
                  <SidebarContent onNav={closeMenu} />
                </div>
              </SheetContent>
            </Sheet>
          )}

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5 select-none">
            <div className="size-8 border-2 border-[#1C293C] bg-[#FDC800] flex items-center justify-center shadow-[2px_2px_0px_0px_#1C293C] shrink-0">
              <Sparkles className="h-4 w-4 text-[#1C293C]" />
            </div>
            <div className="leading-none">
              <span className="font-black text-[15px] text-[#1C293C]">AI Edu</span>
              <span className="font-black text-[15px] text-[#432DD7]">.</span>
              <p className="text-[10px] font-semibold text-[#1C293C]/50 tracking-wide -mt-0.5">
                Учебная платформа
              </p>
            </div>
          </Link>
        </div>

        {/* Right: theme + admin pill + clerk */}
        <div className="flex items-center gap-2">
          <ModeToggle />

          <Link
            href="/admin"
            className="hidden sm:inline-flex items-center gap-1.5 border-2 border-[#1C293C] bg-white px-3 py-1.5 text-xs font-black text-[#1C293C] shadow-[2px_2px_0px_0px_#1C293C] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-100"
          >
            <Shield className="h-3.5 w-3.5" />
            Admin
          </Link>

          <SignedOut>
            <div className="hidden sm:flex items-center gap-2">
              <SignInButton />
              <SignUpButton />
            </div>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
      </header>

      {/* ── BODY ── */}
      <div
        className={cn(
          'flex',
          isGeneratorFocusPage ? 'h-[calc(100vh-60px)] overflow-hidden' : 'min-h-[calc(100vh-60px)]',
        )}
      >

        {/* Desktop Sidebar */}
        {!isGeneratorFocusPage && (
          <aside className="hidden lg:flex w-[240px] shrink-0 flex-col border-r-2 border-[#1C293C] bg-[#FBFBF9]">
            <SidebarContent />
          </aside>
        )}

        {/* Main content */}
        <main className={cn('flex-1 min-w-0', isGeneratorFocusPage && 'overflow-hidden')}>
          <div className={cn(isGeneratorFocusPage ? 'h-full overflow-hidden' : 'p-4 lg:p-8')}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
