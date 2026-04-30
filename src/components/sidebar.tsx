"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, BookOpen, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 border-r border-zinc-800 flex flex-col items-center py-4 gap-2 shrink-0">
      <Link href="/">
        <BookOpen className="h-6 w-6 text-zinc-400 hover:text-zinc-100" />
      </Link>
      <div className="flex-1" />
      <Link href="/">
        <Button variant={pathname === "/" ? "secondary" : "ghost"} size="icon" title="仓库">
          <Home className="h-5 w-5" />
        </Button>
      </Link>
      <Link href="/compare">
        <Button variant={pathname.startsWith("/compare") ? "secondary" : "ghost"} size="icon" title="跨仓库对比">
          <ArrowLeftRight className="h-5 w-5" />
        </Button>
      </Link>
      <Link href="/settings">
        <Button variant={pathname === "/settings" ? "secondary" : "ghost"} size="icon" title="设置">
          <Settings className="h-5 w-5" />
        </Button>
      </Link>
    </aside>
  );
}
