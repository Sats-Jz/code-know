import git from "isomorphic-git";
import http from "isomorphic-git/http/node";
import fs from "node:fs";
import { config } from "./config";

export async function cloneRepo(gitUrl: string, repoName: string): Promise<string> {
  const dir = `${config.dataDir}/${repoName}`;
  await fs.promises.mkdir(dir, { recursive: true });
  await git.clone({ fs, http, dir, url: gitUrl, depth: 1, singleBranch: true });
  return dir;
}

export async function getGitUrlName(url: string): Promise<string> {
  const parts = url.split("/");
  const last = parts[parts.length - 1] || parts[parts.length - 2] || "repo";
  return last.replace(/\.git$/, "");
}
