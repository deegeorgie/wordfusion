import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/providers/AuthProvider";

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
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
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
      </body>
    </html>
  );
}
