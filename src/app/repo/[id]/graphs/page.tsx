"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChartViewer } from "@/components/chart-viewer";
import { Loader2 } from "lucide-react";

export default function GraphsPage() {
  const params = useParams();
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [chart, setChart] = useState<{ mermaid: string; graphType: string } | null>(null);

  async function generate() {
    setLoading(true);
    const res = await fetch("/api/repos/" + params.id + "/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, graphType: "call-chain" }),
    });
    setChart(await res.json());
    setLoading(false);
  }

  return (
    <div className="p-8">
      <div className="flex gap-2 mb-6">
        <Input placeholder="输入要追踪的函数或模块名..." value={target}
          onChange={(e) => setTarget(e.target.value)} className="bg-zinc-900 border-zinc-700 max-w-md"
          onKeyDown={(e) => { if (e.key === "Enter") generate(); }} />
        <Button onClick={generate} disabled={!target || loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          生成图表
        </Button>
      </div>
      {chart && <ChartViewer mermaid={chart.mermaid} chartType={chart.graphType} />}
      {!chart && (
        <div className="text-center text-zinc-500 mt-20">
          <p className="text-lg">生成调用链路图或架构图</p>
          <p className="text-sm mt-2">输入函数名或模块名，AI 会自动分析并生成交互式图表</p>
        </div>
      )}
    </div>
  );
}
