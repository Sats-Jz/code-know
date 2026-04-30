"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const tabs = [
  { name: "概览", href: "" },
  { name: "对话", href: "/chat" },
  { name: "文件", href: "/files" },
  { name: "图表", href: "/graphs" },
];

export default function RepoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams();

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-zinc-800 px-6 py-2 flex gap-1">
        {tabs.map((tab) => {
          const href = "/repo/" + params.id + tab.href;
          const active = pathname === href;
          return (
            <Link key={tab.name} href={href}>
              <Button variant={active ? "secondary" : "ghost"} size="sm">{tab.name}</Button>
            </Link>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
