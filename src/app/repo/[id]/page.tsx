"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function RepoDetail() {
  const params = useParams();
  const [repo, setRepo] = useState<any>(null);

  useEffect(() => {
    fetch("/api/repos/" + params.id).then((r) => r.json()).then(setRepo);
  }, [params.id]);

  if (!repo) return <div className="p-8 text-zinc-500">加载中...</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{repo.name}</h1>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <StatCard label="语言" value={repo.language} />
        <StatCard label="文件数" value={repo.fileCount.toLocaleString()} />
        <StatCard label="代码行数" value={repo.lineCount.toLocaleString()} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
