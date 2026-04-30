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

const definitionTypes = new Set([
  "function_declaration", "method_definition", "class_declaration",
  "interface_declaration", "struct_item", "impl_item", "trait_item",
  "function_item", "constructor", "contract_declaration",
  "function_definition", "class_definition",
]);

export async function chunkFile(repoPath: string, filePath: string): Promise<Chunk[]> {
  const fullPath = path.join(repoPath, filePath);
  const content = fs.readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");
  const ext = path.extname(filePath).toLowerCase();
  const lang = extToLang(ext);

  // 1. Try tree-sitter AST first
  const treeSitterChunks = await tryTreeSitter(content, filePath, lang, lines);
  if (treeSitterChunks.length > 0) return treeSitterChunks;

  // 2. Fall back to regex-based chunking
  const regexChunks = regexChunk(content, filePath, lang, lines);
  if (regexChunks.length > 0) return regexChunks;

  // 3. Last resort: sliding window
  return windowChunk(filePath, lines);
}

function extToLang(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java",
  };
  return map[ext] || ext.slice(1);
}

// ─── tree-sitter AST chunking ─────────────────────────────────────────────

const parserCache = new Map<string, { parser: unknown; grammar: unknown } | null>();

async function tryTreeSitter(content: string, filePath: string, lang: string, lines: string[]): Promise<Chunk[]> {
  const entry = await getParserEntry(lang);
  if (!entry) return [];

  try {
    const { default: Parser } = await import("tree-sitter");
    const parser = new Parser();
    parser.setLanguage(entry.grammar as never);
    const tree = parser.parse(content);
    const chunks: Chunk[] = [];

    function walk(node: { type: string; startPosition: { row: number }; endPosition: { row: number }; childForFieldName?: (n: string) => { text: string } | null; namedChildren: { type: string; text: string }[] }) {
      if (definitionTypes.has(node.type)) {
        const startRow = node.startPosition.row + 1;
        const endRow = node.endPosition.row + 1;
        const chunkLines = endRow - startRow + 1;

        let name: string | null = null;
        try {
          const nameChild = node.childForFieldName?.("name");
          if (nameChild) name = nameChild.text;
        } catch {}
        if (!name) {
          const id = node.namedChildren.find((c: { type: string; text: string }) => c.type === "identifier" || c.type === "property_identifier");
          if (id) name = id.text;
        }

        if (chunkLines <= MAX_CHUNK_LINES) {
          chunks.push({ filePath, startLine: startRow, endLine: endRow, chunkType: node.type, symbolName: name, content: lines.slice(startRow - 1, endRow).join("\n") });
        } else {
          for (const sc of windowChunkSlices(lines.slice(startRow - 1, endRow), startRow)) {
            chunks.push({ ...sc, filePath, chunkType: node.type, symbolName: name });
          }
        }
      }
      for (const child of node.namedChildren || []) {
        walk(child);
      }
    }

    walk(tree.rootNode as never);
    return chunks;
  } catch {
    return [];
  }
}

async function getParserEntry(lang: string) {
  if (parserCache.has(lang)) return parserCache.get(lang);
  let result: { parser: unknown; grammar: unknown } | null = null;

  try {
    const Parser = (await import("tree-sitter")).default;
    let grammar;
    switch (lang) {
      case "typescript": case "tsx": case "javascript":
        grammar = (await import("tree-sitter-typescript")).default; break;
      case "python":
        grammar = (await import("tree-sitter-python")).default; break;
      case "rust":
        grammar = (await import("tree-sitter-rust")).default; break;
      case "go":
        grammar = (await import("tree-sitter-go")).default; break;
      case "java":
        grammar = (await import("tree-sitter-java")).default; break;
    }
    if (grammar) result = { parser: Parser, grammar };
  } catch {}

  parserCache.set(lang, result);
  return result;
}

// ─── Regex-based chunking (fallback) ──────────────────────────────────────

function regexChunk(content: string, filePath: string, lang: string, lines: string[]): Chunk[] {
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
        for (const sc of windowChunkSlices(lines.slice(startLine - 1, endLine), startLine)) {
          chunks.push({ ...sc, filePath, chunkType: "function", symbolName: name });
        }
      } else if (chunkLines > 0) {
        chunks.push({ filePath, startLine, endLine, chunkType: "function", symbolName: name, content: lines.slice(startLine - 1, endLine).join("\n") });
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
    if (char === "}") { braceCount--; if (inBlock && braceCount === 0) return startLine + lineOffset; }
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

// ─── Sliding window chunking (last resort) ────────────────────────────────

function windowChunk(filePath: string, lines: string[]): Chunk[] {
  return windowChunkSlices(lines, 1).map((c) => ({
    ...c, filePath, chunkType: "block", symbolName: null,
  }));
}

function windowChunkSlices(lines: string[], startRow: number): { startLine: number; endLine: number; content: string }[] {
  const slices: { startLine: number; endLine: number; content: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + WINDOW_LINES, lines.length);
    slices.push({ startLine: startRow + i, endLine: startRow + end - 1, content: lines.slice(i, end).join("\n") });
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
