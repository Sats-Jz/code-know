"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, MessageCircle, FolderOpen } from "lucide-react";
import Link from "next/link";

interface Repo {
  id: number;
  name: string;
  language: string;
  fileCount: number;
  lineCount: number;
  indexStatus: string;
  updatedAt: string;
}

export function RepoCard({ repo, onDelete }: { repo: Repo; onDelete: (id: number) => void }) {
  return (
    <Card className="p-4 bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-zinc-500" />
            {repo.name}
            {repo.indexStatus === "indexing" && (
              <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">索引中...</span>
            )}
            {repo.indexStatus === "error" && (
              <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">失败</span>
            )}
          </h3>
          <p className="text-sm text-zinc-500 mt-1">
            {repo.language} · {repo.fileCount.toLocaleString()} 文件 · {repo.lineCount.toLocaleString()} 行
          </p>
        </div>
        <div className="flex gap-1">
          {repo.indexStatus === "ready" && (
            <Link href={`/repo/${repo.id}/chat`}>
              <Button variant="ghost" size="icon" title="对话">
                <MessageCircle className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(repo.id)} title="删除">
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
