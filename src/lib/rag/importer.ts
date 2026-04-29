import fs from "node:fs";
import path from "node:path";
import { config } from "../config";
import { cloneRepo, getGitUrlName } from "../git";

export type ImportSource =
  | { type: "local"; localPath: string }
  | { type: "git"; gitUrl: string }
  | { type: "upload"; filePath: string };

export async function importRepo(source: ImportSource): Promise<{ repoPath: string; repoName: string }> {
  let repoPath: string;
  let repoName: string;

  if (source.type === "local") {
    repoName = path.basename(source.localPath);
    repoPath = `${config.dataDir}/${repoName}`;
    await copyDir(source.localPath, repoPath);
  } else if (source.type === "git") {
    repoName = await getGitUrlName(source.gitUrl);
    repoPath = await cloneRepo(source.gitUrl, repoName);
  } else {
    throw new Error("Upload import not yet implemented");
  }

  return { repoPath, repoName };
}

export async function getRepoFiles(repoPath: string): Promise<string[]> {
  const files: string[] = [];
  const ignorePatterns = await loadGitignore(repoPath);

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoPath, fullPath);

      if (shouldIgnore(relPath, ignorePatterns)) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (isCodeFile(relPath)) {
          files.push(relPath);
        }
      }
    }
  }

  await walk(repoPath);
  return files;
}

const CODE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".sol",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".kt",
  ".scala", ".r", ".m", ".mm", ".vue", ".svelte", ".astro",
]);

function isCodeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return CODE_EXTENSIONS.has(ext);
}

async function loadGitignore(repoPath: string): Promise<string[]> {
  const patterns: string[] = ["node_modules", ".git", "dist", "build", ".next", "target", "__pycache__", "*.lock", "*.json", "*.toml"];
  try {
    const content = await fs.promises.readFile(path.join(repoPath, ".gitignore"), "utf-8");
    patterns.push(...content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#")));
  } catch {
    // no .gitignore
  }
  return patterns;
}

function shouldIgnore(relPath: string, patterns: string[]): boolean {
  const parts = relPath.replace(/\\/g, "/").split("/");
  for (const pattern of patterns) {
    if (parts.includes(pattern) || relPath.startsWith(pattern)) return true;
    if (pattern.endsWith("/") && relPath.startsWith(pattern)) return true;
  }
  return false;
}

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

export function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go", ".java": "java", ".sol": "solidity",
    ".c": "c", ".cpp": "cpp", ".rb": "ruby", ".php": "php", ".swift": "swift",
    ".kt": "kotlin", ".vue": "vue", ".svelte": "svelte",
  };
  return map[ext] || "text";
}

export function countRepoStats(repoPath: string, files: string[]): { fileCount: number; lineCount: number; language: string } {
  let lineCount = 0;
  const langCount = new Map<string, number>();
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(repoPath, file), "utf-8");
      lineCount += content.split("\n").length;
      const lang = detectLanguage(file);
      langCount.set(lang, (langCount.get(lang) || 0) + 1);
    } catch {
      // skip
    }
  }
  const language = [...langCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "unknown";
  return { fileCount: files.length, lineCount, language };
}
