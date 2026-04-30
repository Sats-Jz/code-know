"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
  const streamContentRef = useRef("");
  const streamMsgIdRef = useRef("");
  const streamingRef = useRef(false);

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Load conversation list
  const fetchConvs = useCallback(async () => {
    const res = await fetch("/api/repos/" + repoId + "/conversations");
    setConvs(await res.json());
  }, [repoId]);

  useEffect(() => { fetchConvs(); }, [fetchConvs]);

  async function loadConversation(id: number) {
    setConvId(id);
    const res = await fetch("/api/repos/" + repoId + "/conversations/" + id);
    const rows = await res.json();
    const msgs: Message[] = rows.map((r: any) => {
      let content = "";
      try {
        const parsed = JSON.parse(r.content);
        if (typeof parsed === "string") content = parsed;
        else if (Array.isArray(parsed)) content = parsed.filter((p: any) => p.type === "text").map((p: any) => p.data).join("");
      } catch { content = r.content; }
      return { id: String(r.id), role: r.role, content };
    }).filter((m: Message) => m.content);
    setMessages(msgs);
  }

  function newConversation() {
    setConvId(null);
    setMessages([]);
  }

  // Update streamed message using ref to avoid React Strict Mode double-fire
  const updateStreamContent = useCallback(() => {
    const id = streamMsgIdRef.current;
    if (!id) return;
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) return prev;
      const updated = [...prev];
      updated[idx] = { ...updated[idx], content: streamContentRef.current };
      return updated;
    });
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || streamingRef.current) return;
    streamingRef.current = true;
    streamContentRef.current = "";
    setStreaming(true);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    const aiMsgId = (Date.now() + 1).toString();
    streamMsgIdRef.current = aiMsgId;
    const aiMsg: Message = { id: aiMsgId, role: "assistant", content: "" };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    const currentInput = input;
    setInput("");

    const body: any = { message: currentInput };
    if (convId) body.conversation_id = convId;

    const res = await fetch("/api/repos/" + repoId + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    if (!reader) { setStreaming(false); streamingRef.current = false; return; }

    let eventType = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || ""; // keep incomplete part

      for (const part of parts) {
        let evType = "";
        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) evType = line.slice(7).trim();
          else if (line.startsWith("data: ")) {
            try {
              const raw = JSON.parse(line.slice(6));
              if (evType === "meta" && raw && raw.conversation_id) {
                setConvId(raw.conversation_id);
                fetchConvs();
              } else if (evType === "text" || evType === "chart" || evType === "references" || evType === "") {
                if (typeof raw === "string") {
                  streamContentRef.current += raw;
                } else if (raw && typeof raw === "object" && raw.delta) {
                  streamContentRef.current += raw.delta;
                }
                updateStreamContent();
              }
            } catch {}
          }
        }
      }
    }

    streamContentRef.current = "";
    streamMsgIdRef.current = "";
    streamingRef.current = false;
    setStreaming(false);
    fetchConvs();
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  return (
    <div className="flex h-full">
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
