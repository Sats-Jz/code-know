"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [status, setStatus] = useState<Record<string, boolean | null>>({ deepseek: null, chromadb: null });
  const [testing, setTesting] = useState(false);

  async function testConnections() {
    setTesting(true);
    const res = await fetch("/api/settings/test-connection", { method: "POST" });
    setStatus(await res.json());
    setTesting(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">设置</h1>
      <Card className="p-6 bg-zinc-900 border-zinc-800 space-y-4">
        <h2 className="font-semibold">连接状态</h2>
        <div className="flex items-center justify-between">
          <span>DeepSeek API</span>
          {status.deepseek === null ? <span className="text-zinc-500">未测试</span>
          : status.deepseek ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="h-4 w-4" /> 正常</span>
          : <span className="flex items-center gap-1 text-red-400"><XCircle className="h-4 w-4" /> 失败</span>}
        </div>
        <div className="flex items-center justify-between">
          <span>ChromaDB</span>
          {status.chromadb === null ? <span className="text-zinc-500">未测试</span>
          : status.chromadb ? <span className="flex items-center gap-1 text-green-400"><CheckCircle className="h-4 w-4" /> 正常</span>
          : <span className="flex items-center gap-1 text-red-400"><XCircle className="h-4 w-4" /> 失败</span>}
        </div>
        <Button onClick={testConnections} disabled={testing} className="w-full">
          {testing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          测试连接
        </Button>
      </Card>
    </div>
  );
}
