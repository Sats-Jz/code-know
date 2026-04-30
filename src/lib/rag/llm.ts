import { getDeepSeekClient } from "../deepseek";
import { hybridSearch, type SearchResult } from "./retriever";

const SYSTEM_PROMPT = `你是一个资深代码架构师。基于提供的代码片段回答用户问题。

回答要求：
- 引用具体文件路径和行号，格式: \`[file:path/to/file.ts:42]\`
- 如需展示调用链或架构关系，用 [chart:类型]...[/chart] 包裹 Mermaid 代码
- 代码示例使用标准 Markdown 代码块，标注语言
- 解释要清晰深入，逐层分析
- 如果信息不足，明确指出`;

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function* chatStream(
  repoId: number,
  query: string,
  history: ChatMessage[] = [],
): AsyncGenerator<{ type: "text" | "chart" | "references" | "done"; data: unknown }> {
  const results = await hybridSearch(repoId, query, 15);
  const context = buildContext(results);

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-10),
    { role: "user", content: `${context}\n\n用户问题: ${query}` },
  ];

  const client = getDeepSeekClient();
  const stream = await client.chat.completions.create({
    model: "deepseek-v4-pro",
    messages,
    stream: true,
    temperature: 0.3,
    max_tokens: 8192,
  });

  let fullText = "";

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      fullText += delta;
      yield { type: "text", data: delta };
    }
  }

  const chartMatch = fullText.match(/\[chart:(\w+)\]([\s\S]*?)\[\/chart\]/g);
  if (chartMatch) {
    for (const m of chartMatch) {
      const typeMatch = m.match(/\[chart:(\w+)\]/);
      const bodyMatch = m.match(/\[chart:\w+\]([\s\S]*?)\[\/chart\]/);
      if (typeMatch && bodyMatch) {
        yield { type: "chart", data: { chartType: typeMatch[1], mermaid: bodyMatch[1].trim() } };
      }
    }
  }

  const fileRefs = extractFileRefs(fullText);
  if (fileRefs.length > 0) {
    yield { type: "references", data: fileRefs };
  }

  yield { type: "done", data: { tokensUsed: fullText.length } };
}

function buildContext(results: SearchResult[]): string {
  const grouped = new Map<string, SearchResult[]>();
  for (const r of results) {
    const existing = grouped.get(r.filePath) || [];
    existing.push(r);
    grouped.set(r.filePath, existing);
  }

  let ctx = "以下是相关代码片段：\n\n";
  for (const [file, chunks] of grouped) {
    ctx += `### ${file}\n`;
    for (const c of chunks) {
      const name = c.symbolName ? ` [${c.symbolName}]` : "";
      ctx += `\`\`\`${c.chunkType} L${c.startLine}-L${c.endLine}${name}\n${c.content}\n\`\`\`\n\n`;
    }
  }
  return ctx;
}

function extractFileRefs(text: string): string[] {
  const matches = text.matchAll(/\[file:([^\]]+)\]/g);
  return [...matches].map((m) => m[1]);
}
