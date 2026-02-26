/**
 * HCL/Terraform Parser
 *
 * Lightweight regex-based parser for .tf/.hcl files.
 * Extracts resource, data, variable, output, module, and provider blocks.
 */

import type { LanguageParser, ParserResult } from "./index.js";
import type { Symbol, SymbolKind } from "../types.js";
import type { LanguageId } from "../language-detect.js";

export class HclParser implements LanguageParser {
  language: LanguageId = "hcl" as LanguageId;

  async parse(content: string, filePath: string): Promise<ParserResult> {
    const symbols: Symbol[] = [];
    const lines = content.split("\n");

    // HCL block patterns:
    //   resource "aws_instance" "web" {
    //   data "aws_ami" "ubuntu" {
    //   variable "region" {
    //   output "ip" {
    //   module "vpc" {
    //   provider "aws" {
    //   terraform {
    //   locals {
    const blockPattern = /^(resource|data|variable|output|module|provider|terraform|locals)\s+(?:"([^"]+)"\s+)?(?:"([^"]+)"\s*)?\{/;

    const kindMap: Record<string, SymbolKind> = {
      resource: "class",
      data: "property",
      variable: "variable",
      output: "property",
      module: "module",
      provider: "namespace",
      terraform: "namespace",
      locals: "namespace",
    };

    let lineNum = 0;
    let prevComment = "";

    for (const line of lines) {
      lineNum++;
      const trimmed = line.trim();

      // Track comments
      if (trimmed.startsWith("#") || trimmed.startsWith("//")) {
        prevComment = trimmed.replace(/^[#/]+\s*/, "");
        continue;
      }

      const match = trimmed.match(blockPattern);
      if (match) {
        const blockType = match[1];
        const type = match[2] || "";
        const name = match[3] || match[2] || blockType;

        const displayName = type && match[3]
          ? `${blockType}.${type}.${match[3]}`
          : type
            ? `${blockType}.${type}`
            : blockType;

        symbols.push({
          id: `${filePath}:${displayName}`,
          name: displayName,
          kind: kindMap[blockType] || "property",
          visibility: "public",
          location: { file: filePath, line: lineNum, column: 0 },
          exported: true,
          typeAnnotation: blockType,
          docs: prevComment ? { summary: prevComment } : undefined,
        });
        prevComment = "";
        continue;
      }

      if (trimmed !== "") {
        prevComment = "";
      }
    }

    // Determine summary from file content
    const basename = filePath.split("/").pop() || "";
    let summary = "Terraform configuration";
    if (basename === "main.tf") summary = "Main Terraform configuration";
    else if (basename === "variables.tf") summary = "Terraform variable definitions";
    else if (basename === "outputs.tf") summary = "Terraform output definitions";
    else if (basename === "providers.tf") summary = "Terraform provider configuration";
    else if (basename === "versions.tf") summary = "Terraform version constraints";
    else if (basename === "backend.tf") summary = "Terraform backend configuration";
    else if (basename.endsWith(".hcl")) summary = "HCL configuration";

    return {
      symbols,
      imports: [],
      exports: [],
      moduleDoc: { summary },
    };
  }
}
