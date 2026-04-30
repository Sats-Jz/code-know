"use client";

import { useEffect, useState, useCallback } from "react";
import { RepoCard } from "@/components/repo-card";
import { ImportDialog } from "@/components/import-dialog";

export default function Home() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRepos = useCallback(async () => {
    const res = await fetch("/api/repos");
    setRepos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRepos(); }, [fetchRepos]);

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
        <ImportDialog onImport={fetchRepos} />
      </div>
      {loading ? (
        <p className="text-zinc-500">加载中...</p>
      ) : repos.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <p className="text-lg mb-2">还没有导入任何仓库</p>
          <p>点击「导入仓库」开始</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {repos.map((repo: any) => <RepoCard key={repo.id} repo={repo} onDelete={handleDelete} />)}
        </div>
      )}
    </div>
  );
}
