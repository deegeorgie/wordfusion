import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PWARegistration } from "@/components/providers/PWARegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mots Croisés - Puzzles Gratuits Quotidiens",
  description: "Jouez aux mots croisés gratuits en français. Un nouveau puzzle chaque jour !",
  keywords: ["mots croisés", "crossword", "puzzle", "jeux", "français", "gratuit", "quotidien"],
  authors: [{ name: "Georges BODIONG", url: "https://deebodiong.quarto.pub" }],
  icons: {
    icon: "/logo_WF.png",
    apple: "/icons/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Mots Croisés - Puzzles Gratuits Quotidiens",
    description: "Jouez aux mots croisés gratuits en français. Un nouveau puzzle chaque jour !",
    siteName: "Mots Croisés",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mots Croisés - Puzzles Gratuits Quotidiens",
    description: "Jouez aux mots croisés gratuits en français. Un nouveau puzzle chaque jour !",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16a6c9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
        <PWARegistration />
      </body>
    </html>
  );
}
