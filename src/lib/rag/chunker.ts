import fs from "node:fs";
import path from "node:path";

const MAX_CHUNK_LINES = 60;
const WINDOW_LINES = 30;
const OVERLAP_LINES = 8;

export interface Chunk {
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: string;
  symbolName: string | null;
  content: string;
}

export async function chunkFile(repoPath: string, filePath: string): Promise<Chunk[]> {
  const fullPath = path.join(repoPath, filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");
  const ext = path.extname(filePath).toLowerCase();
  const lang = extToLang(ext);

  const chunks = regexChunk(content, filePath, lang, lines);
  if (chunks.length > 0) return chunks;

  return windowChunk(filePath, lines);
}

function extToLang(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java",
  };
  return map[ext] || ext.slice(1);
}

function regexChunk(
  content: string,
  filePath: string,
  lang: string,
  lines: string[],
): Chunk[] {
  const chunks: Chunk[] = [];
  const patterns = getLangPatterns(lang);
  if (!patterns) return [];

  for (const pattern of patterns) {
    const regex = new RegExp(pattern, "gm");
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1] || match[2] || null;
      const beforeMatch = content.slice(0, match.index);
      const startLine = beforeMatch.split("\n").length;
      const body = content.slice(match.index);
      const endLine = findEndLine(body, startLine, lines);
      const chunkLines = endLine - startLine + 1;

      if (chunkLines > MAX_CHUNK_LINES) {
        const subChunks = windowChunkSlices(lines.slice(startLine - 1, endLine), startLine);
        for (const sc of subChunks) {
          chunks.push({ ...sc, filePath, chunkType: "function", symbolName: name });
        }
      } else if (chunkLines > 0) {
        chunks.push({
          filePath,
          startLine,
          endLine,
          chunkType: "function",
          symbolName: name,
          content: lines.slice(startLine - 1, endLine).join("\n"),
        });
      }
    }
  }

  return chunks;
}

function findEndLine(body: string, startLine: number, lines: string[]): number {
  let braceCount = 0;
  let inBlock = false;
  let lineOffset = 0;
  for (const char of body) {
    if (char === "\n") lineOffset++;
    if (char === "{") { braceCount++; inBlock = true; }
    if (char === "}") {
      braceCount--;
      if (inBlock && braceCount === 0) {
        return startLine + lineOffset;
      }
    }
  }
  return Math.min(startLine + MAX_CHUNK_LINES, lines.length);
}

function getLangPatterns(lang: string): string[] | null {
  const patterns: Record<string, string[]> = {
    typescript: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/gm,
      /(?:export\s+)?class\s+(\w+)/gm,
      /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm,
      /(?:export\s+)?(?:async\s+)?(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
      /(?:export\s+)?interface\s+(\w+)/gm,
    ],
    javascript: [
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/gm,
      /(?:export\s+)?class\s+(\w+)/gm,
      /(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/gm,
    ],
    python: [
      /^\s*def\s+(\w+)\s*\(/gm,
      /^\s*class\s+(\w+)/gm,
      /^\s*async\s+def\s+(\w+)\s*\(/gm,
    ],
    rust: [
      /^\s*(?:pub\s+)?fn\s+(\w+)/gm,
      /^\s*(?:pub\s+)?struct\s+(\w+)/gm,
      /^\s*(?:pub\s+)?trait\s+(\w+)/gm,
      /^\s*(?:pub\s+)?impl\b/gm,
    ],
    go: [
      /^\s*func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/gm,
      /^\s*type\s+(\w+)\s+struct/gm,
      /^\s*type\s+(\w+)\s+interface/gm,
    ],
    java: [
      /(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?\w+\s+(\w+)\s*\([^)]*\)\s*\{/gm,
      /(?:public\s+)?class\s+(\w+)/gm,
      /(?:public\s+)?interface\s+(\w+)/gm,
    ],
  };
  return patterns[lang] || null;
}

function windowChunk(filePath: string, lines: string[]): Chunk[] {
  return windowChunkSlices(lines, 1).map((c) => ({
    ...c,
    filePath,
    chunkType: "block",
    symbolName: null,
  }));
}

function windowChunkSlices(lines: string[], startRow: number): { startLine: number; endLine: number; content: string }[] {
  const slices: { startLine: number; endLine: number; content: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + WINDOW_LINES, lines.length);
    slices.push({
      startLine: startRow + i,
      endLine: startRow + end - 1,
      content: lines.slice(i, end).join("\n"),
    });
    i += WINDOW_LINES - OVERLAP_LINES;
  }
  return slices;
}

export async function chunkRepo(repoPath: string, files: string[]): Promise<Chunk[]> {
  const allChunks: Chunk[] = [];
  for (const file of files) {
    const chunks = await chunkFile(repoPath, file);
    allChunks.push(...chunks);
  }
  return allChunks;
}
