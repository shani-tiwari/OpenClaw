import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { AgentConfig, ActionLog } from "./types";
import { ActionTracker } from "./action-tracker";
import { throwDeprecation } from "node:process";

/* Text files - will treat as UTF-8 binaries */
const TEXT_EXT = new Set([
  ".md",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".json",
  ".mjs",
  ".cjs",
  ".mdx",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".txt",
]);

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXT.has(ext) || ext === "";
}

export class ToolExecutor {
  /* Staged changes - stored here */
  private overlay = new Map<string, string>();
  /* Staged deletions - stored here */
  private deleted = new Set<string>();

  /* Normalized path for os specific seprators */
  private readonly norm = (rel: string): string => {
    return path.posix
      .normalize(rel.split(path.sep).join("/"))
      .replace(/^\.\//, "");
    // make sure to return it.
  };

  /* Resolve relative paths safely - inside your codebase */
  private resolveSafe(rel: string): string {
    const abs = path.resolve(this.config.codebasePath, rel);
    const root = path.resolve(this.config.codebasePath);
    const relChk = path.relative(root, abs);

    /* If the resolved path is outside the codebase path throw an error */
    if (relChk.startsWith("..") || path.isAbsolute(relChk)) {
      throw new Error(`Path escaped wprkspace ${rel}`);
    }

    return abs;
  }

  /* Excluded files like git, node_modules */
  private excluded(relPath: string): boolean {
    const norm = this.norm(relPath);

    const segments = norm.split("/");

    const base = segments[segments.length - 1] ?? "";

    for (const pat of this.config.excludePatterns) {
      if (pat === "*.log" && base.startsWith(".log")) return true;
      if (pat === ".env*" && base.startsWith(".env")) return true;
      if (pat.includes("*")) continue;
      if (segments.includes(pat) || norm === pat || norm.startsWith(`${pat}/`))
        return true;
    }

    return false;
  }

  /* check excluded or not path */
  private assertNotExcluded(rel: string, op: string): void {
    if (this.excluded(rel)) {
      throw new Error(`${op}: path is excluded by policy: ${rel}.`);
    }
  }

  /* for getting effective text */
  getEffectiveText(rel: string): string | undefined {
    const key = this.norm(rel);

    if (this.deleted.has(key)) return undefined;
    if (this.overlay.has(key)) return this.overlay.get(key);

    const abs = this.resolveSafe(rel);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return undefined;

    return fs.readFileSync(abs, "utf-8");
  }

  readFile(rel: string): string {
    this.assertNotExcluded(rel, "read_file");

    const abs = this.resolveSafe(rel);

    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
      throw new Error(`File not found: ${rel}`);
    }

    const st = fs.statSync(abs);

    if (st.size > this.config.maxFileSizeToRead) {
      throw new Error(`File too large: ${rel}`);
    }

    const text = fs.readFileSync(abs, "utf8");

    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rel),
      details: {
        after: text,
        toolName: "read_file",
      },
      status: "executed",
    });

    return text;
  }

  listFiles(rel: string, recursive: boolean): string {
    this.assertNotExcluded(rel, "list_files");

    const abs = this.resolveSafe(rel);

    if (!fs.existsSync(abs)) {
      throw new Error(`list_files: not found: ${rel}`);
    }

    const lines: string[] = [];

    const walk = (dir: string, prefix: string) => {
      const entries = fs.readdirSync(dir, {
        withFileTypes: true,
      });

      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        const relP = path.relative(this.config.codebasePath, full);

        if (this.excluded(relP)) continue;

        if (ent.isDirectory()) {
          lines.push(`${prefix}${ent.name}/`);

          if (recursive) {
            walk(full, `${prefix}${ent.name}/`);
          }
        } else {
          lines.push(`${prefix}${ent.name}`);
        }
      }
    };

    if (fs.statSync(abs).isDirectory()) {
      walk(abs, "");
    } else {
      lines.push(path.relative(this.config.codebasePath, abs));
    }

    const out = lines.sort().join("\n");

    this.tracker.log({
      type: "code_analysis",
      path: this.norm(rel),
      details: {
        after: out,
        toolName: "list_files",
      },
      status: "executed",
    });

    return out || "(empty)";
  }

  createFolder(rel: string): string {
    if (!this.config.tools.allowFolderCreation) {
      throw new Error("Folder creation disabled");
    }

    this.assertNotExcluded(rel, "create_folder");

    const key = this.norm(rel);

    this.tracker.log({
      type: "folder_create",
      path: key,
      details: {
        after: key,
      },
      status: "pending",
    });

    return `Staged folder: ${key}`;
  }

  createFile(rel: string, content: string): string {
    if (!this.config.tools.allowFileCreation) {
      throw new Error("File creation disabled");
    }

    this.assertNotExcluded(rel, "create_file");

    const key = this.norm(rel);
    const abs = this.resolveSafe(rel);

    if (fs.existsSync(abs) && !this.deleted.has(key)) {
      throw new Error(`create_file: already exists: ${rel}`);
    }

    this.deleted.delete(key);
    this.overlay.set(key, content);

    this.tracker.log({
      type: "file_create",
      path: key,
      details: {
        after: content,
      },
      status: "pending",
    });

    return `Staged new file: ${key}`;
  }

  modifyFile(rel: string, content: string): string {
    if (!this.config.tools.allowFileModification) {
      throw new Error("File modification disabled");
    }

    this.assertNotExcluded(rel, "modify_file");

    const before = this.getEffectiveText(rel);

    if (before === undefined) {
      throw new Error(`modify_file: file not found: ${rel}`);
    }

    const key = this.norm(rel);

    this.overlay.set(key, content);

    this.tracker.log({
      type: "file_modify",
      path: key,
      details: {
        before,
        after: content,
      },
      status: "pending",
    });

    return `Staged update: ${key}`;
  }

  deleteFile(rel: string): string {
    if (!this.config.tools.allowFileModification) {
      throw new Error("File deletion disabled");
    }

    this.assertNotExcluded(rel, "delete_file");

    const before = this.getEffectiveText(rel);

    if (before === undefined) {
      throw new Error(`delete_file: file not found: ${rel}`);
    }

    const key = this.norm(rel);

    this.overlay.delete(key);
    this.deleted.add(key);

    this.tracker.log({
      type: "file_delete",
      path: key,
      details: {
        before,
      },
      status: "pending",
    });

    return `Staged delete: ${key}`;
  }

  /* Tool executor uses child procees to run commands */
  constructor(
    private readonly config: AgentConfig,
    private readonly tracker: ActionTracker,
  ) {}
}
