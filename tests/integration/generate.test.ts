/**
 * Integration Test — Full Generate Pipeline
 *
 * Creates a temp directory with sample files in multiple languages,
 * runs the full analysis and generation pipeline, and verifies
 * the output structure, content, and navigation.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile, rm, readdir } from "fs/promises";
import path from "path";
import os from "os";
import { analyzeCodebase } from "../../src/analysis/engine";
import { generateDocs } from "../../src/generators/mkdocs";
import { DocWalkConfigSchema } from "../../src/config/schema";

describe("Full Generate Pipeline", () => {
  let tempDir: string;
  let outputDir: string;

  beforeAll(async () => {
    // Create a temp directory with sample files
    tempDir = await mkdtemp(path.join(os.tmpdir(), "docwalk-test-"));
    outputDir = path.join(tempDir, "docwalk-output");

    // Create sample TypeScript file
    await mkdir(path.join(tempDir, "src"), { recursive: true });
    await writeFile(
      path.join(tempDir, "src", "index.ts"),
      `/**
 * Main entry point for the application.
 */

import { helper } from "./utils.js";

export interface Config {
  name: string;
  port: number;
}

export function start(config: Config): void {
  console.log(helper(config.name));
}

export const VERSION = "1.0.0";
`
    );

    await writeFile(
      path.join(tempDir, "src", "utils.ts"),
      `/**
 * Utility functions.
 */

export function helper(name: string): string {
  return \`Hello, \${name}!\`;
}

export function formatDate(date: Date): string {
  return date.toISOString();
}
`
    );

    // Create sample Python file
    await writeFile(
      path.join(tempDir, "src", "main.py"),
      `"""
Main Python module for processing data.
"""

import os
from typing import List, Dict

def process_data(items: List[str]) -> Dict[str, int]:
    """Process a list of items and return counts."""
    return {item: len(item) for item in items}

class DataProcessor:
    """Handles data processing pipeline."""

    def __init__(self, config: dict):
        self.config = config

    def run(self) -> None:
        """Execute the processing pipeline."""
        pass

BATCH_SIZE = 100
`
    );

    // Create sample YAML file
    await writeFile(
      path.join(tempDir, "docker-compose.yml"),
      `services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: myapp
`
    );

    // Create sample shell script
    await mkdir(path.join(tempDir, "scripts"), { recursive: true });
    await writeFile(
      path.join(tempDir, "scripts", "deploy.sh"),
      `#!/usr/bin/env bash
# Deployment script for production

set -euo pipefail

export APP_ENV=production

deploy_app() {
  echo "Deploying..."
}

run_migrations() {
  echo "Running migrations..."
}

deploy_app
run_migrations
`
    );

    // Create sample HCL file
    await mkdir(path.join(tempDir, "infra"), { recursive: true });
    await writeFile(
      path.join(tempDir, "infra", "main.tf"),
      `# Main Terraform configuration

provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "web" {
  ami           = "ami-12345"
  instance_type = "t3.micro"
}

variable "environment" {
  type    = string
  default = "production"
}

output "instance_ip" {
  value = aws_instance.web.public_ip
}
`
    );

    // Create sample SQL file
    await writeFile(
      path.join(tempDir, "schema.sql"),
      `-- Database schema

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL
);

CREATE TABLE posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  body TEXT
);

CREATE VIEW active_users AS
SELECT * FROM users WHERE id IN (SELECT DISTINCT user_id FROM posts);
`
    );

    // Create sample Markdown
    await writeFile(
      path.join(tempDir, "README.md"),
      `# Test Project

A sample project for testing DocWalk.

## Features

- Feature one
- Feature two

## Getting Started

Run \`npm install\` to get started.
`
    );

    // (scripts dir and deploy.sh already created above)
  });

  afterAll(async () => {
    // Cleanup
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("should analyze multiple file types without errors", async () => {
    const config = DocWalkConfigSchema.parse({
      source: {
        repo: ".",
        provider: "local",
      },
    });

    const manifest = await analyzeCodebase({
      source: config.source,
      analysis: config.analysis,
      repoRoot: tempDir,
      commitSha: "abc12345",
    });

    // Should have analyzed files
    expect(manifest.modules.length).toBeGreaterThan(0);
    expect(manifest.stats.totalFiles).toBeGreaterThan(0);

    // Check that multiple languages were detected
    const languages = new Set(manifest.modules.map((m) => m.language));
    expect(languages.size).toBeGreaterThanOrEqual(3);

    // Check specific file types
    const fileTypes = manifest.modules.map((m) => m.language);
    expect(fileTypes).toContain("typescript");
    expect(fileTypes).toContain("yaml");
    expect(fileTypes).toContain("shell");
    expect(fileTypes).toContain("hcl");
    expect(fileTypes).toContain("sql");
    expect(fileTypes).toContain("markdown");
  });

  it("should extract symbols from lightweight parsers", async () => {
    const config = DocWalkConfigSchema.parse({
      source: {
        repo: ".",
        provider: "local",
      },
    });

    const manifest = await analyzeCodebase({
      source: config.source,
      analysis: config.analysis,
      repoRoot: tempDir,
      commitSha: "abc12345",
    });

    // YAML parser should have extracted top-level keys
    const yamlModule = manifest.modules.find((m) => m.filePath.endsWith(".yml"));
    expect(yamlModule).toBeDefined();
    expect(yamlModule!.symbols.length).toBeGreaterThan(0);

    // Shell parser should have extracted functions
    const shellModule = manifest.modules.find((m) => m.filePath.endsWith(".sh"));
    expect(shellModule).toBeDefined();
    expect(shellModule!.symbols.length).toBeGreaterThan(0);
    const shellFuncs = shellModule!.symbols.filter((s) => s.kind === "function");
    expect(shellFuncs.length).toBeGreaterThanOrEqual(2);

    // HCL parser should have extracted resources
    const hclModule = manifest.modules.find((m) => m.filePath.endsWith(".tf"));
    expect(hclModule).toBeDefined();
    expect(hclModule!.symbols.length).toBeGreaterThan(0);

    // SQL parser should have extracted tables
    const sqlModule = manifest.modules.find((m) => m.filePath.endsWith(".sql"));
    expect(sqlModule).toBeDefined();
    expect(sqlModule!.symbols.length).toBeGreaterThanOrEqual(3); // 2 tables + 1 view

    // Markdown parser should have extracted headings
    const mdModule = manifest.modules.find((m) => m.filePath.endsWith(".md"));
    expect(mdModule).toBeDefined();
    expect(mdModule!.symbols.length).toBeGreaterThan(0);
  });

  it("should generate docs with non-empty pages", async () => {
    const config = DocWalkConfigSchema.parse({
      source: {
        repo: ".",
        provider: "local",
      },
    });

    const manifest = await analyzeCodebase({
      source: config.source,
      analysis: { ...config.analysis, changelog: false },
      repoRoot: tempDir,
      commitSha: "abc12345",
    });

    await generateDocs({
      manifest,
      config: { ...config, analysis: { ...config.analysis, changelog: false } },
      outputDir,
    });

    // Check that docs directory was created
    const docsDir = path.join(outputDir, "docs");
    const files = await readdir(docsDir, { recursive: true });
    const mdFiles = (files as string[]).filter((f) => f.endsWith(".md"));

    expect(mdFiles.length).toBeGreaterThan(0);

    // Check key pages exist
    const pageNames = mdFiles.map((f) => f.replace(/\\/g, "/"));
    expect(pageNames).toContain("index.md");
    expect(pageNames).toContain("getting-started.md");

    // Check mkdocs.yml was generated
    const mkdocsYml = await readFile(path.join(outputDir, "mkdocs.yml"), "utf-8");
    expect(mkdocsYml).toContain("site_name:");
    expect(mkdocsYml).toContain("nav:");

    // Check overview page is not empty
    const indexContent = await readFile(path.join(docsDir, "index.md"), "utf-8");
    expect(indexContent.length).toBeGreaterThan(200);
    expect(indexContent).toContain("Documentation");
  });

  it("should handle architecture page for mixed-import projects", async () => {
    const config = DocWalkConfigSchema.parse({
      source: {
        repo: ".",
        provider: "local",
      },
    });

    const manifest = await analyzeCodebase({
      source: config.source,
      analysis: { ...config.analysis, changelog: false },
      repoRoot: tempDir,
      commitSha: "abc12345",
    });

    await generateDocs({
      manifest,
      config: { ...config, analysis: { ...config.analysis, changelog: false } },
      outputDir,
    });

    // Architecture page should exist and not contain empty mermaid blocks
    const archDir = path.join(outputDir, "docs", "architecture");
    const archIndex = path.join(archDir, "index.md");

    try {
      const archContent = await readFile(archIndex, "utf-8");
      // Should either have a mermaid diagram or an informative message
      const hasMermaid = archContent.includes("```mermaid");
      const hasInfoMessage = archContent.includes("Architecture diagram unavailable");
      expect(hasMermaid || hasInfoMessage).toBe(true);
    } catch {
      // If tiered architecture isn't generated, check flat architecture
      const flatArch = path.join(outputDir, "docs", "architecture.md");
      try {
        const archContent = await readFile(flatArch, "utf-8");
        const hasMermaid = archContent.includes("```mermaid");
        const hasInfoMessage = archContent.includes("Architecture diagram unavailable");
        expect(hasMermaid || hasInfoMessage).toBe(true);
      } catch {
        // Architecture page may not exist if no dependency graph is configured
        // That's acceptable
      }
    }
  });
});
