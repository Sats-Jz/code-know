"use client";

import { useEffect, useState } from "react";
import { Folder, File, FolderOpen } from "lucide-react";

interface TreeNode {
  name: string; path: string; type: "file" | "directory"; children?: TreeNode[];
}

export function FileTree({ repoId, onSelectFile }: { repoId: string; onSelectFile: (path: string) => void }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/repos/" + repoId + "/tree").then((r) => r.json()).then(setTree);
  }, [repoId]);

  return (
    <div className="text-sm">
      {tree.map((node) => (
        <TreeNodeItem key={node.path} node={node} depth={0} expanded={expanded} setExpanded={setExpanded} repoId={repoId} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}

function TreeNodeItem({ node, depth, expanded, setExpanded, repoId, onSelectFile }: {
  node: TreeNode; depth: number; expanded: Set<string>; setExpanded: (s: Set<string>) => void;
  repoId: string; onSelectFile: (path: string) => void;
}) {
  const isOpen = expanded.has(node.path);

  const toggle = async () => {
    if (node.type === "file") { onSelectFile(node.path); return; }
    if (isOpen) { const next = new Set(expanded); next.delete(node.path); setExpanded(next); }
    else {
      const res = await fetch("/api/repos/" + repoId + "/tree?dir=" + node.path);
      node.children = await res.json();
      const next = new Set(expanded); next.add(node.path); setExpanded(next);
    }
  };

  return (
    <div>
      <button onClick={toggle} className="flex items-center gap-1 w-full text-left px-2 py-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-100" style={{ paddingLeft: depth * 16 + 8 }}>
        {node.type === "directory" ? (isOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0" /> : <Folder className="h-3.5 w-3.5 shrink-0" />) : <File className="h-3.5 w-3.5 shrink-0" />}
        <span className="truncate">{node.name}</span>
      </button>
      {isOpen && node.children?.map((child) => (
        <TreeNodeItem key={child.path} node={child} depth={depth + 1} expanded={expanded} setExpanded={setExpanded} repoId={repoId} onSelectFile={onSelectFile} />
      ))}
    </div>
  );
}
