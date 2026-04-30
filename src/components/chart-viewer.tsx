"use client";

import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export function ChartViewer({ mermaid, chartType }: { mermaid: string; chartType: string }) {
  const lines = mermaid.split("\n").filter(Boolean);
  const nodes: { name: string }[] = [];
  const links: { source: string; target: string }[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const parts = line.split(/-->|->|-->/).map((s) => s.trim().replace(/[|\[\]()]/g, ""));
    if (parts.length === 2) {
      const [from, to] = parts;
      if (!seen.has(from)) { nodes.push({ name: from }); seen.add(from); }
      if (!seen.has(to)) { nodes.push({ name: to }); seen.add(to); }
      links.push({ source: from, target: to });
    }
  }

  if (nodes.length === 0) {
    return <pre className="text-sm text-zinc-400 p-4 whitespace-pre-wrap">{mermaid}</pre>;
  }

  const option = {
    tooltip: {},
    animation: true,
    series: [{
      type: "graph", layout: "force", roam: true,
      data: nodes, links: links,
      force: { repulsion: 200, edgeLength: [100, 300] },
      label: { show: true, color: "#a6adc8", fontSize: 12 },
      lineStyle: { color: "#45475a", curveness: 0.2 },
    }],
  };

  return <ReactECharts option={option} style={{ height: 500 }} />;
}
