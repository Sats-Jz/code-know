"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { RepoCard } from "@/components/repo-card";
import { ImportDialog } from "@/components/import-dialog";

export default function Home() {
  const [repos, setRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    const data = await res.json();
    setRepos(data);
    setLoading(false);
    // Auto-poll if any repo is importing/indexing
    const hasIndexing = data.some((r: any) => r.indexStatus === "indexing" || r.indexStatus === "importing");
    if (hasIndexing && !pollRef.current) {
      pollRef.current = setInterval(fetchRepos, 3000);
    } else if (!hasIndexing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
      setImporting(false);
    }
    return data;
  }, []);

  useEffect(() => { fetchRepos(); return () => { if (pollRef.current) clearInterval(pollRef.current); }; }, [fetchRepos]);

  const handleImport = async () => {
    setImporting(true);
    await fetchRepos();
  };

  const handleDelete = async (id: number) => {
    await fetch("/api/repos/" + id, { method: "DELETE" });
    fetchRepos();
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Code-Know</h1>
          <p className="text-zinc-500 mt-1">个人 AI 代码导师与大型 Repo 解析器</p>
        </div>
        <ImportDialog onImport={handleImport} />
      </div>

      {loading ? (
        <div className="text-center py-20 text-zinc-500">
          <div className="animate-pulse">加载中...</div>
        </div>
      ) : repos.length === 0 && !importing ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg mb-2">还没有导入任何仓库</p>
          <p>点击「导入仓库」开始</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {repos.map((repo: any) => <RepoCard key={repo.id} repo={repo} onDelete={handleDelete} />)}
        </div>
      )}

      {importing && (
        <p className="text-sm text-zinc-500 mt-4 text-center animate-pulse">正在后台索引中，请稍候...</p>
      )}
    </div>
  );
}
