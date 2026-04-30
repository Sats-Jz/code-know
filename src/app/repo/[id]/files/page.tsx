"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";

export default function FilesPage() {
  const params = useParams();
  const [file, setFile] = useState<{ path: string; content: string; language: string } | null>(null);

  async function handleSelectFile(path: string) {
    const res = await fetch("/api/repos/" + params.id + "/file?path=" + path);
    setFile(await res.json());
  }

  return (
    <div className="flex h-full">
      <div className="w-72 border-r border-zinc-800 overflow-auto p-2">
        <FileTree repoId={params.id as string} onSelectFile={handleSelectFile} />
      </div>
      <div className="flex-1 overflow-auto p-6">
        {file ? (
          <div>
            <p className="text-sm text-zinc-500 mb-3">{file.path}</p>
            <CodeViewer content={file.content} language={file.language} />
          </div>
        ) : (
          <p className="text-zinc-500 text-center mt-20">选择文件查看代码</p>
        )}
      </div>
    </div>
  );
}
