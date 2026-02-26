/**
 * DocWalk Deploy Provider Interface
 *
 * Defines the contract for hosting providers and manages
 * the provider registry. Each provider handles:
 * - Project creation/configuration
 * - Build artifact upload
 * - Domain and SSL setup
 * - CI/CD pipeline generation
 */

import type { DeployConfig, DomainConfig } from "../config/schema.js";

// ─── Provider Interface ─────────────────────────────────────────────────────

export interface DeployResult {
  url: string;
  previewUrl?: string;
  provider: string;
  projectId: string;
  domain?: string;
  ssl: boolean;
  ciConfigPath?: string;
}

export interface DeployProvider {
  /** Provider identifier matching config enum */
  id: string;

  /** Human-readable name */
  name: string;

  /** Check if the provider CLI/API is available and authenticated */
  checkAuth(): Promise<{ authenticated: boolean; message: string }>;

  /** Create or configure the hosting project */
  setupProject(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ projectId: string }>;

  /** Deploy built site to the provider */
  deploy(
    buildDir: string,
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<DeployResult>;

  /** Configure custom domain and SSL */
  configureDomain(
    domain: DomainConfig,
    deploy: DeployConfig
  ): Promise<{ configured: boolean; dnsRecords?: DNSRecord[] }>;

  /** Generate CI/CD configuration file (GitHub Actions, etc.) */
  generateCIConfig(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ path: string; content: string }>;
}

export interface DNSRecord {
  type: "CNAME" | "A" | "AAAA" | "TXT";
  name: string;
  value: string;
  ttl?: number;
}

// ─── Provider Registry ──────────────────────────────────────────────────────

const providers = new Map<string, DeployProvider>();

export function registerProvider(provider: DeployProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): DeployProvider | undefined {
  return providers.get(id);
}

export function getAvailableProviders(): DeployProvider[] {
  return [...providers.values()];
}

// ─── Barrel Exports for Providers ───────────────────────────────────────────
// TODO: Import and register each provider:
// import { GitHubPagesProvider } from "./providers/github-pages.js";
// import { CloudflareProvider } from "./providers/cloudflare.js";
// import { VercelProvider } from "./providers/vercel.js";
// import { NetlifyProvider } from "./providers/netlify.js";
// import { S3Provider } from "./providers/s3.js";
