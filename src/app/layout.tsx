import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Code-Know",
  description: "Personal AI Code Tutor & Repo Parser",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
