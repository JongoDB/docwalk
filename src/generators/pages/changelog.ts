import path from "path";
import simpleGit from "simple-git";
import type { DocWalkConfig } from "../../config/schema.js";
import type { GeneratedPage } from "../../analysis/types.js";
import { resolveRepoRoot } from "../../utils/index.js";
import { parseConventionalType } from "../utils.js";

export async function generateChangelogPage(config: DocWalkConfig): Promise<GeneratedPage> {
  let changelogContent = "";

  try {
    const repoRoot = resolveRepoRoot(config.source);

    const git = simpleGit(repoRoot);

    // Get tags sorted by creation date (newest first)
    const tagsResult = await git.tags(["--sort=-creatordate"]);
    const versionTags = tagsResult.all
      .filter((t) => /^v?\d+\.\d+/.test(t));

    // Get recent commits
    const logResult = await git.log({
      maxCount: config.analysis.changelog_depth || 100,
    });

    if (logResult.all.length === 0) {
      changelogContent = "*No commits found.*\n";
    } else if (versionTags.length > 0) {
      // ── Version-grouped changelog ──────────────────────────────
      // Get tag dates for display
      const tagDates = new Map<string, string>();
      for (const tag of versionTags) {
        try {
          const tagLog = await git.log({ maxCount: 1, from: undefined, to: tag } as any);
          if (tagLog.latest) {
            tagDates.set(tag, new Date(tagLog.latest.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));
          }
        } catch {
          // skip
        }
      }

      // All commits as a list with hashes
      const allCommits = logResult.all.map((c) => ({
        hash: c.hash,
        message: c.message,
        author: c.author_name,
        date: c.date,
        type: parseConventionalType(c.message),
      }));

      // Build commit hash set for each tag
      const tagCommitSets: Array<{ tag: string; commits: typeof allCommits }> = [];
      for (let i = 0; i < versionTags.length; i++) {
        const tag = versionTags[i];
        const prevTag = versionTags[i + 1];
        try {
          const range = prevTag ? `${prevTag}..${tag}` : tag;
          const rangeLog = await git.log({ from: prevTag, to: tag, maxCount: 50 } as any);
          tagCommitSets.push({
            tag,
            commits: rangeLog.all.map((c) => ({
              hash: c.hash,
              message: c.message,
              author: c.author_name,
              date: c.date,
              type: parseConventionalType(c.message),
            })),
          });
        } catch {
          tagCommitSets.push({ tag, commits: [] });
        }
      }

      // Unreleased commits (after latest tag)
      if (versionTags.length > 0) {
        try {
          const unreleasedLog = await git.log({ from: versionTags[0], maxCount: 50 } as any);
          if (unreleasedLog.all.length > 0) {
            changelogContent += `## Unreleased\n\n`;
            for (const commit of unreleasedLog.all) {
              const shortHash = commit.hash.slice(0, 7);
              const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
              changelogContent += `- \`${shortHash}\` ${parseConventionalType(commit.message)}: ${cleanMsg}\n`;
            }
            changelogContent += "\n";
          }
        } catch {
          // no unreleased commits
        }
      }

      // Each version as expandable block
      const typeLabels: Record<string, string> = {
        feat: "Features",
        fix: "Bug Fixes",
        docs: "Documentation",
        refactor: "Refactoring",
        test: "Tests",
        chore: "Chores",
        perf: "Performance",
        ci: "CI/CD",
        style: "Style",
        build: "Build",
        other: "Other Changes",
      };

      for (let i = 0; i < tagCommitSets.length; i++) {
        const { tag, commits } = tagCommitSets[i];
        const dateStr = tagDates.get(tag) || "";
        const admonType = i === 0 ? "success" : "note";

        if (commits.length === 0) {
          changelogContent += `??? ${admonType} "${tag}${dateStr ? ` — ${dateStr}` : ""}"\n    No commits in this release.\n\n`;
          continue;
        }

        changelogContent += `??? ${admonType} "${tag}${dateStr ? ` — ${dateStr}` : ""} (${commits.length} change${commits.length > 1 ? "s" : ""})"\n`;

        // Group by type
        const grouped: Record<string, typeof commits> = {};
        for (const commit of commits) {
          if (!grouped[commit.type]) grouped[commit.type] = [];
          grouped[commit.type].push(commit);
        }

        for (const [type, label] of Object.entries(typeLabels)) {
          const typeCommits = grouped[type];
          if (!typeCommits || typeCommits.length === 0) continue;

          changelogContent += `    ### ${label}\n`;
          for (const commit of typeCommits) {
            const shortHash = commit.hash.slice(0, 7);
            const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
            changelogContent += `    - \`${shortHash}\` ${cleanMsg}${commit.author ? ` *(${commit.author})*` : ""}\n`;
          }
          changelogContent += "\n";
        }
      }
    } else {
      // ── No version tags — flat conventional grouping ───────────
      const typeLabels: Record<string, string> = {
        feat: "Features",
        fix: "Bug Fixes",
        docs: "Documentation",
        refactor: "Refactoring",
        test: "Tests",
        chore: "Chores",
        perf: "Performance",
        ci: "CI/CD",
        style: "Style",
        build: "Build",
        other: "Other Changes",
      };

      const grouped: Record<string, Array<{ hash: string; message: string; author: string; date: string }>> = {};
      for (const commit of logResult.all) {
        const type = parseConventionalType(commit.message);
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date,
        });
      }

      for (const [type, label] of Object.entries(typeLabels)) {
        const commits = grouped[type];
        if (!commits || commits.length === 0) continue;

        changelogContent += `## ${label}\n\n`;
        for (const commit of commits.slice(0, 20)) {
          const shortHash = commit.hash.slice(0, 7);
          const cleanMsg = commit.message.replace(/^(feat|fix|docs|refactor|test|chore|perf|ci|style|build)(\([^)]*\))?:\s*/, "");
          const dateStr = commit.date ? new Date(commit.date).toLocaleDateString() : "";
          changelogContent += `- \`${shortHash}\` ${cleanMsg}${dateStr ? ` *(${dateStr})*` : ""}\n`;
        }
        changelogContent += "\n";
      }
    }

    // Check for CHANGELOG.md or RELEASE_NOTES.md in repo root
    try {
      const { readFile: readFs } = await import("fs/promises");
      for (const notesFile of ["CHANGELOG.md", "RELEASE_NOTES.md"]) {
        try {
          const notesPath = path.join(repoRoot, notesFile);
          const notesContent = await readFs(notesPath, "utf-8");
          if (notesContent.trim()) {
            changelogContent += `---\n\n## Project Release Notes\n\n`;
            changelogContent += `??? note "From ${notesFile}"\n`;
            for (const line of notesContent.split("\n").slice(0, 50)) {
              changelogContent += `    ${line}\n`;
            }
            changelogContent += "\n";
            break;
          }
        } catch {
          // file not found
        }
      }
    } catch {
      // fs import failed
    }
  } catch {
    changelogContent = "*Unable to generate changelog — not a git repository or git is not available.*\n";
  }

  if (!changelogContent) {
    changelogContent = "*No commits found.*\n";
  }

  const content = `---
title: Changelog
description: Project changelog generated from git history
---

# Changelog

${changelogContent}

---

*Auto-generated from git history by DocWalk. Updates on each sync.*
`;

  return {
    path: "changelog.md",
    title: "Changelog",
    content,
    navGroup: "",
    navOrder: 99,
    audience: "developer",
  };
}
