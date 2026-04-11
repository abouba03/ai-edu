'use client';

import React, { useState } from 'react';
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
  Settings2,
  Sparkles,
  Shield,
  ChevronRight,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';

import { useEffect } from "react"
import { useAuth } from "@clerk/nextjs"

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {

  const { isSignedIn } = useAuth()
  const [userName, setUserName] = useState("Étudiant")
  const [userLevel, setUserLevel] = useState("débutant")
  const [userLoaded, setUserLoaded] = useState(false)

  useEffect(() => {
    if (isSignedIn) {
      fetch("/api/sync-user", { method: "POST" })
    }
  }, [isSignedIn])

  useEffect(() => {
    fetch("/api/me")
      .then((res) => res.json())
      .then((data) => {
        setUserName(data?.name ?? "Étudiant")
        setUserLevel(data?.level ?? "débutant")
      })
      .finally(() => setUserLoaded(true))
  }, [isSignedIn])

  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const primaryRoutes = [
    {
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: '/dashboard',
      active: pathname === '/dashboard' || pathname === '/',
    },
    {
      label: 'Cours',
      icon: <BookOpen className="h-5 w-5" />,
      href: '/courses',
      active: pathname.startsWith('/courses'),
    },
    {
      label: 'Challenges',
      icon: <Trophy className="h-5 w-5" />,
      href: '/challenges',
      active: pathname.startsWith('/challenges'),
    },
    {
      label: 'Profil',
      icon: <User className="h-5 w-5" />,
      href: '/profile',
      active: pathname.startsWith('/profile'),
    },
  ];

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden rounded-xl">
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[86%] sm:w-[360px]">
                <SheetHeader>
                  <SheetTitle className="text-left">Navigation</SheetTitle>
                </SheetHeader>
                <div className="py-5 space-y-5">
                  <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-3">
                    <Avatar>
                      <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{userLoaded ? userName : 'Chargement...'}</p>
                      <p className="text-xs text-muted-foreground">Niveau: {userLevel}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {primaryRoutes.map((route) => (
                      <Link
                        key={route.href}
                        href={route.href}
                        onClick={closeMobileMenu}
                        className={cn(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all border',
                          route.active
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-accent border-border',
                        )}
                      >
                        {route.icon}
                        {route.label}
                        <ChevronRight className="ml-auto h-4 w-4 opacity-60" />
                      </Link>
                    ))}
                  </div>

                  <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2.5">
                    <ModeToggle />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="rounded-lg">
                          <Settings2 className="h-4 w-4" /> Options
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuLabel>Options</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/admin" onClick={closeMobileMenu} className="cursor-pointer">
                            <Shield className="h-4 w-4" /> Page Admin
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/profile" onClick={closeMobileMenu} className="cursor-pointer">
                            <User className="h-4 w-4" /> Profil utilisateur
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">AI Edu Platform</p>
                <p className="text-xs text-muted-foreground truncate">Learning Workspace</p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ModeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl">
                  <Settings2 className="h-4.5 w-4.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="cursor-pointer">
                    <Shield className="h-4 w-4" /> Page Admin
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="h-4 w-4" /> Profil utilisateur
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)] lg:min-h-[calc(100vh-64px)]">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex w-[300px] flex-col border-r bg-card/40 backdrop-blur px-4 py-4">
          <div className="rounded-2xl border bg-background px-3 py-3 mb-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Navigation principale</p>
            <p className="text-sm font-semibold mt-1">Accès rapide</p>
          </div>

          <div className="flex flex-col flex-1 overflow-auto">
            <nav className="flex flex-col space-y-1.5">
              {primaryRoutes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all border",
                    route.active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-accent border-border"
                  )}
                >
                  {route.icon}
                  {route.label}
                  <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-4">
              <div className="rounded-xl border bg-background p-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Options</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-lg">
                      <Settings2 className="h-4 w-4" /> Ouvrir
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer">
                        <Shield className="h-4 w-4" /> Page Admin
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer">
                        <User className="h-4 w-4" /> Profil utilisateur
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-3 rounded-xl px-3 py-3 mt-auto border bg-background">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden text-ellipsis">
                  <div className="font-medium">{userLoaded ? userName : "Chargement..."}</div>
                  <div className="text-sm text-muted-foreground">Niveau: {userLevel}</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}