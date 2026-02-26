'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ModeToggle } from '@/components/theme-toggle';
import { usePathname } from 'next/navigation';
import {
  Code,
  CheckSquare,
  Trophy,
  Brain,
  Home,
  Menu,
  X,
  User,
  LayoutDashboard,
  BookOpen,
  Settings2,
  Sparkles,
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

  const routes = [
    {
      label: 'Dashboard',
      icon: <Home className="h-5 w-5" />,
      href: '/',
      active: pathname === '/',
    },
    {
      label: 'Tableau de bord',
      icon: <LayoutDashboard className="h-5 w-5" />,
      href: '/dashboard',
      active: pathname === '/dashboard',
    },
    {
      label: 'Cours',
      icon: <BookOpen className="h-5 w-5" />,
      href: '/courses',
      active: pathname.startsWith('/courses'),
    },
    {
      label: 'Admin',
      icon: <Settings2 className="h-5 w-5" />,
      href: '/admin',
      active: pathname.startsWith('/admin'),
    },
    {
      label: 'Générateur',
      icon: <Code className="h-5 w-5" />,
      href: '/generator',
      active: pathname === '/generator',
    },
    {
      label: 'Correcteur',
      icon: <CheckSquare className="h-5 w-5" />,
      href: '/corrector',
      active: pathname === '/corrector',
    },
    {
      label: 'Débogueur',
      icon: <Brain className="h-5 w-5" />,
      href: '/debugger',
      active: pathname === '/debugger',
    },
    {
      label: 'Quiz & Défis',
      icon: <Trophy className="h-5 w-5" />,
      href: '/challenges',
      active: pathname === '/challenges',
    },
    {
      label: 'Profil',
      icon: <User className="h-5 w-5" />,
      href: '/profile',
      active: pathname === '/profile',
    },
  ];

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:hidden">
        <div className="container flex h-14 items-center">
          <div className="flex items-center justify-between w-full">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="size-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-bold text-lg">AI Edu Studio</span>
            </Link>
            <div className="flex items-center gap-1">
              <ModeToggle />
              <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    {isMobileMenuOpen ? (
                      <X className="h-5 w-5" />
                    ) : (
                      <Menu className="h-5 w-5" />
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-[80%] sm:w-[350px]">
                  <SheetHeader>
                    <SheetTitle className="text-left font-bold text-xl">AI Edu Studio</SheetTitle>
                  </SheetHeader>
                  <div className="py-6">
                    <div className="flex items-center gap-4 p-4 mb-6 rounded-xl bg-card border">
                      <Avatar>
                        <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{userLoaded ? userName : "Chargement..."}</div>
                        <div className="text-sm text-muted-foreground">Niveau: {userLevel}</div>
                      </div>
                    </div>
                    <nav className="flex flex-col space-y-1">
                      {routes.map((route) => (
                        <Link
                          key={route.href}
                          href={route.href}
                          onClick={closeMobileMenu}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
                            route.active
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          )}
                        >
                          {route.icon}
                          {route.label}
                        </Link>
                      ))}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-56px)] lg:min-h-screen">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex h-screen w-[280px] flex-col fixed inset-y-0 z-50 border-r bg-card/50 backdrop-blur">
          <div className="px-4 py-4 h-16 flex items-center border-b">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-base">AI Edu Studio</p>
                <p className="text-xs text-muted-foreground">Master Project Platform</p>
              </div>
            </Link>
          </div>
          <div className="flex flex-col flex-1 overflow-auto py-4 px-3">
            <nav className="flex flex-col space-y-1.5">
              {routes.map((route) => (
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
                </Link>
              ))}
            </nav>

            <div className="mt-auto space-y-4">
              <div className="px-2">
                <ModeToggle />
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
        <main className="flex-1 lg:pl-[280px]">
          <div className="p-4 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}