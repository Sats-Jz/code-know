"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ChatMessage } from "@/components/chat-message";
import { ArrowLeftRight, Send, Loader2, Check } from "lucide-react";

interface Repo {
  id: number;
  name: string;
  language: string;
  indexStatus: string;
}

export default function ComparePage() {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [question, setQuestion] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    fetch("/api/repos").then((r) => r.json()).then(setRepos);
  }, []);

  const toggleRepo = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const askQuestion = async () => {
    if (!question.trim() || selected.length < 2 || streaming) return;
    setAnswer("");
    setStreaming(true);

    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoIds: selected, question }),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { setStreaming(false); return; }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.delta) setAnswer((prev) => prev + data.delta);
          } catch {}
        }
      }
    }
    setStreaming(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center gap-2 mb-6">
        <ArrowLeftRight className="h-6 w-6 text-zinc-400" />
        <h1 className="text-2xl font-bold">跨仓库对比</h1>
      </div>

      <p className="text-sm text-zinc-500 mb-4">选择至少 2 个仓库，提问对比它们的实现差异</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
        {repos.filter((r) => r.indexStatus === "ready").map((repo) => {
          const isSelected = selected.includes(repo.id);
          return (
            <button key={repo.id} onClick={() => toggleRepo(repo.id)}
              className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${isSelected ? "border-blue-500 bg-blue-900/20 text-blue-400" : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700"}`}>
              {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
              <span className="truncate">{repo.name}</span>
              <span className="text-xs text-zinc-600 ml-auto">{repo.language}</span>
            </button>
          );
        })}
        {repos.filter((r) => r.indexStatus === "ready").length < 2 && (
          <p className="col-span-full text-zinc-500 text-sm">需要至少 2 个索引完成的仓库才能对比</p>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Textarea value={question} onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); askQuestion(); } }}
          placeholder={'例如："这两个仓库的认证实现有什么不同？"'}
          className="bg-zinc-900 border-zinc-700 min-h-[60px] flex-1" disabled={streaming || selected.length < 2} />
        <Button onClick={askQuestion} disabled={!question.trim() || selected.length < 2 || streaming} size="icon" className="shrink-0">
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {answer && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
          <ChatMessage role="assistant" content={answer} />
        </div>
      )}

      {!answer && !streaming && (
        <div className="text-center text-zinc-500 mt-16">
          <p className="text-lg">选择仓库并提问</p>
          <p className="text-sm mt-2">AI 会同时检索多个仓库的代码，进行对比分析</p>
        </div>
      )}
    </div>
  );
}
