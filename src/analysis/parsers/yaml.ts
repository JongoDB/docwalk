/**
 * YAML Parser
 *
 * Lightweight regex-based parser for .yaml/.yml files.
 * Extracts top-level keys as symbols and detects file purpose
 * from common patterns (Ansible, Docker Compose, K8s, GitHub Actions, Helm).
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type { Symbol, DocComment } from "../types.js";
import type { LanguageId } from "../language-detect.js";

export class YamlParser implements LanguageParser {
  language: LanguageId = "yaml" as LanguageId;

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");

    // Extract top-level keys (lines starting without indentation, ending with :)
    const topLevelKeyPattern = /^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/;
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      const match = line.match(topLevelKeyPattern);
      if (match) {
        symbols.push({
          id: `${filePath}:${match[1]}`,
          name: match[1],
          kind: "property",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
        });
      }
    }

    // Detect file purpose
    const summary = detectYamlPurpose(content, filePath);

    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: summary ? { summary } : undefined,
    };
  }
}

function detectYamlPurpose(content: string, filePath: string): string {
  const lower = content.toLowerCase();
  const basename = filePath.split("/").pop()?.toLowerCase() || "";

  // Ansible playbook
  if (lower.includes("hosts:") && lower.includes("tasks:")) {
    return "Ansible playbook";
  }
  if (lower.includes("- role:") || lower.includes("ansible.builtin")) {
    return "Ansible role configuration";
  }

  // Docker Compose
  if (lower.includes("services:") && (lower.includes("image:") || lower.includes("build:"))) {
    return "Docker Compose file";
  }

  // Kubernetes
  if (lower.includes("apiversion:") && lower.includes("kind:")) {
    const kindMatch = content.match(/kind:\s*(\S+)/i);
    const kind = kindMatch ? kindMatch[1] : "resource";
    return `Kubernetes ${kind}`;
  }

  // GitHub Actions
  if ((lower.includes("on:") || lower.includes("'on':")) && lower.includes("jobs:")) {
    return "GitHub Actions workflow";
  }

  // Helm
  if (basename === "chart.yaml" || basename === "chart.yml") {
    return "Helm chart definition";
  }
  if (basename === "values.yaml" || basename === "values.yml") {
    return "Helm values configuration";
  }

  // CI configs
  if (basename === ".gitlab-ci.yml") {
    return "GitLab CI/CD configuration";
  }
  if (basename === ".travis.yml") {
    return "Travis CI configuration";
  }

  // Generic
  if (basename.endsWith(".yml") || basename.endsWith(".yaml")) {
    return "YAML configuration file";
  }

  return "";
}
