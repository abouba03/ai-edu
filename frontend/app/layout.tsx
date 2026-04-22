import type { Metadata } from "next";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toast";
import MainLayout from "@/components/layout/main-layout";
import { getMe } from "@/lib/get-me";

export const metadata: Metadata = {
  title: "AI Edu Platform",
  description: "Plateforme d'apprentissage avec tuteur IA",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialUser = await getMe();

  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <MainLayout initialUser={initialUser}>
              {children}
            </MainLayout>
            <ToastProvider />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
