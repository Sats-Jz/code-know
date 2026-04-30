"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, MessageSquare, Plus } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface Conv {
  id: number;
  title: string;
  mode: string;
  createdAt: string;
}

export function ChatPanel({ repoId }: { repoId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [convId, setConvId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load conversation list
  useEffect(() => {
    fetch("/api/repos/" + repoId + "/conversations").then((r) => r.json()).then(setConvs);
  }, [repoId]);

  // Load a conversation
  async function loadConversation(id: number) {
    setConvId(id);
    const res = await fetch("/api/repos/" + repoId + "/conversations/" + id);
    const rows = await res.json();
    const msgs: Message[] = rows.map((r: any) => {
      let content = "";
      try {
        const parsed = JSON.parse(r.content);
        if (typeof parsed === "string") content = parsed;
        else if (parsed.text) content = parsed.text;
        else if (Array.isArray(parsed)) content = parsed.filter((p: any) => p.type === "text").map((p: any) => p.data).join("");
      } catch { content = r.content; }
      return { id: String(r.id), role: r.role, content };
    }).filter((m: Message) => m.content);
    setMessages(msgs);
    // Refresh list in case a new conv was added
    fetch("/api/repos/" + repoId + "/conversations").then((r) => r.json()).then(setConvs);
  }

  // Start new conversation
  function newConversation() {
    setConvId(null);
    setMessages([]);
  }

  const sendMessage = async () => {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "assistant", content: "" };
    setMessages((prev) => [...prev, aiMsg]);

    const body: any = { message: input };
    if (convId) body.conversation_id = convId;

    const res = await fetch("/api/repos/" + repoId + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { setStreaming(false); return; }

    let gotConvId = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      const lines = text.split("\n");
      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          try {
            const raw = JSON.parse(line.slice(6));
            // data could be either a plain string (text delta) or an object
            if (typeof raw === "string") {
              if (eventType === "text" || eventType === "") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1].content += raw;
                  return updated;
                });
              }
            } else if (raw && typeof raw === "object") {
              if (raw.delta) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1].content += raw.delta;
                  return updated;
                });
              }
              if (raw.conversation_id && !gotConvId) {
                gotConvId = true;
                setConvId(raw.conversation_id);
                fetch("/api/repos/" + repoId + "/conversations").then((r) => r.json()).then(setConvs);
              }
            }
          } catch {}
        }
      }
    }
    setStreaming(false);
    // Refresh conv list
    fetch("/api/repos/" + repoId + "/conversations").then((r) => r.json()).then(setConvs);
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      <div className="w-56 border-r border-zinc-800 flex flex-col shrink-0">
        <div className="p-2 border-b border-zinc-800">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={newConversation}>
            <Plus className="h-4 w-4" /> 新对话
          </Button>
        </div>
        <div className="flex-1 overflow-auto">
          {convs.map((c) => (
            <button key={c.id} onClick={() => loadConversation(c.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800 transition-colors flex items-center gap-2 ${convId === c.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"}`}>
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
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
    </div>
  );
}
