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

  /** Remove a deployment and clean up provider resources */
  undeploy(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ success: boolean; message: string }>;

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

  /** Generate PR preview deployment workflow */
  generatePreviewCIConfig(
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

// ─── Auto-register built-in providers ───────────────────────────────────────

import { GitHubPagesProvider } from "./providers/github-pages.js";
import { CloudflareProvider } from "./providers/cloudflare.js";
import { VercelProvider } from "./providers/vercel.js";

registerProvider(new GitHubPagesProvider());
registerProvider(new CloudflareProvider());
registerProvider(new VercelProvider());
