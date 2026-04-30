import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";

export function ChatMessage({ role, content }: { role: "user" | "assistant"; content: string }) {
  return (
    <div className={`flex gap-3 py-4 ${role === "assistant" ? "bg-zinc-900/50" : ""} px-4`}>
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${role === "assistant" ? "bg-green-900/50 text-green-400" : "bg-blue-900/50 text-blue-400"}`}>
        {role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0 prose prose-invert prose-sm max-w-none">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
