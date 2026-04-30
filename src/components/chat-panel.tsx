"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({ repoId }: { repoId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, aiMsg]);

    const res = await fetch("/api/repos/" + repoId + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
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
            if (data.delta) setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1].content += data.delta;
              return updated;
            });
          } catch {}
        }
      }
    }
    setStreaming(false);
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 mt-32">
            <p className="text-lg">向 AI 提问关于这个仓库的任何问题</p>
            <p className="text-sm mt-2">例如：「解释认证流程」「画出核心调用链」「这个函数做了什么」</p>
          </div>
        )}
        {messages.map((msg) => <ChatMessage key={msg.id} role={msg.role} content={msg.content} />)}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-zinc-800 p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题... (Enter 发送)" className="bg-zinc-900 border-zinc-700 min-h-[44px] max-h-[120px]" rows={1} disabled={streaming} />
          <Button onClick={sendMessage} disabled={streaming || !input.trim()} size="icon" className="shrink-0">
            {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
