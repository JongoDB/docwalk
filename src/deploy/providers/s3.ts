/**
 * AWS S3 Deploy Provider
 *
 * Deploys documentation to an S3 bucket with optional CloudFront
 * invalidation via:
 * 1. AWS CLI for bucket management and sync
 * 2. Environment-based auth (AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY)
 * 3. Auto-generated GitHub Actions workflow
 */

import type { DeployProvider, DeployResult, DNSRecord } from "../index.js";
import type { DeployConfig, DomainConfig } from "../../config/schema.js";
import { runTool, ToolNotFoundError, ZENSICAL_INSTALL_CMD } from "../../utils/cli-tools.js";

export class S3Provider implements DeployProvider {
  id = "s3";
  name = "AWS S3";

  async checkAuth(): Promise<{ authenticated: boolean; message: string }> {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (accessKey && secretKey) {
      return { authenticated: true, message: "AWS credentials found" };
    }

    try {
      await runTool("aws", ["sts", "get-caller-identity"]);
      return {
        authenticated: true,
        message: "Authenticated via AWS CLI",
      };
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        return { authenticated: false, message: error.message };
      }
      return {
        authenticated: false,
        message:
          "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or configure AWS CLI with `aws configure`.",
      };
    }
  }

  async setupProject(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ projectId: string }> {
    const bucketName = deploy.project || "docwalk-docs";
    const region = (deploy.provider_config?.region as string) || "us-east-1";

    try {
      await runTool("aws", [
        "s3",
        "mb",
        `s3://${bucketName}`,
        "--region",
        region,
      ]);

      // Enable static website hosting
      await runTool("aws", [
        "s3",
        "website",
        `s3://${bucketName}`,
        "--index-document",
        "index.html",
        "--error-document",
        "404.html",
      ]);
    } catch {
      // Bucket may already exist — that's fine
    }

    return { projectId: bucketName };
  }

  async deploy(
    buildDir: string,
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<DeployResult> {
    const bucketName = deploy.project || "docwalk-docs";
    const region = (deploy.provider_config?.region as string) || "us-east-1";
    const cloudFrontId = deploy.provider_config?.cloudfront_distribution_id as string | undefined;

    await runTool("aws", [
      "s3",
      "sync",
      buildDir,
      `s3://${bucketName}`,
      "--delete",
      "--region",
      region,
    ]);

    // Optional CloudFront invalidation
    if (cloudFrontId) {
      try {
        await runTool("aws", [
          "cloudfront",
          "create-invalidation",
          "--distribution-id",
          cloudFrontId,
          "--paths",
          "/*",
        ]);
      } catch {
        // Non-fatal — CloudFront may not be configured
      }
    }

    const baseUrl = domain.custom
      ? `https://${domain.custom}${domain.base_path}`
      : `http://${bucketName}.s3-website-${region}.amazonaws.com`;

    return {
      url: baseUrl,
      provider: this.id,
      projectId: bucketName,
      domain: domain.custom,
      ssl: !!domain.custom || !!cloudFrontId,
    };
  }

  async undeploy(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ success: boolean; message: string }> {
    const bucketName = deploy.project || "docwalk-docs";

    try {
      // Empty the bucket first
      await runTool("aws", [
        "s3",
        "rm",
        `s3://${bucketName}`,
        "--recursive",
      ]);
      // Then remove the bucket
      await runTool("aws", [
        "s3",
        "rb",
        `s3://${bucketName}`,
      ]);
      return {
        success: true,
        message: `S3 bucket '${bucketName}' has been deleted`,
      };
    } catch (error) {
      if (error instanceof ToolNotFoundError) {
        return { success: false, message: error.message };
      }
      return {
        success: false,
        message:
          `Could not delete S3 bucket '${bucketName}'. ` +
          "Delete it manually from the AWS console.",
      };
    }
  }

  async configureDomain(
    domain: DomainConfig,
    deploy: DeployConfig
  ): Promise<{ configured: boolean; dnsRecords?: DNSRecord[] }> {
    if (!domain.custom) {
      return { configured: true };
    }

    const bucketName = deploy.project || "docwalk-docs";
    const region = (deploy.provider_config?.region as string) || "us-east-1";

    return {
      configured: false,
      dnsRecords: [
        {
          type: "CNAME",
          name: domain.custom.split(".")[0],
          value: `${bucketName}.s3-website-${region}.amazonaws.com`,
        },
      ],
    };
  }

  async generateCIConfig(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ path: string; content: string }> {
    const bucketName = deploy.project || "docwalk-docs";
    const region = (deploy.provider_config?.region as string) || "us-east-1";
    const cloudFrontId = deploy.provider_config?.cloudfront_distribution_id as string | undefined;

    const invalidationStep = cloudFrontId
      ? `
      - name: Invalidate CloudFront Cache
        run: aws cloudfront create-invalidation --distribution-id ${cloudFrontId} --paths "/*"
`
      : "";

    const content = `# DocWalk — AWS S3 Deployment
# Auto-generated by DocWalk. Modify with care.

name: Deploy Documentation

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${region}

      - name: DocWalk Sync and Generate
        run: |
          docwalk sync
          docwalk generate

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy to S3
        run: aws s3 sync site s3://${bucketName} --delete
${invalidationStep}`;

    return {
      path: ".github/workflows/docwalk-deploy.yml",
      content,
    };
  }

  async generatePreviewCIConfig(
    deploy: DeployConfig,
    domain: DomainConfig
  ): Promise<{ path: string; content: string }> {
    const bucketName = deploy.project || "docwalk-docs";
    const region = (deploy.provider_config?.region as string) || "us-east-1";

    const content = `# DocWalk — PR Preview Deployment (AWS S3)
# Auto-generated by DocWalk. Deploys a preview to a PR-specific prefix.

name: PR Documentation Preview

on:
  pull_request:
    branches: [main]

jobs:
  preview:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      id-token: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install DocWalk
        run: npm install -g docwalk

      - name: Install Zensical
        run: ${ZENSICAL_INSTALL_CMD}

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${region}

      - name: DocWalk Generate
        run: docwalk generate --full

      - name: Build Site
        run: zensical build --config-file docwalk-output/mkdocs.yml --site-dir site

      - name: Deploy Preview to S3
        run: aws s3 sync site s3://${bucketName}/pr-\${{ github.event.pull_request.number }} --delete

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            const previewUrl = 'http://${bucketName}.s3-website-${region}.amazonaws.com/pr-\${{ github.event.pull_request.number }}';
            await github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: \`## Documentation Preview\\n\\nPreview deployed to: \${previewUrl}\\n\\n> _Generated by DocWalk_\`
            });
`;

    return {
      path: ".github/workflows/docwalk-preview.yml",
      content,
    };
  }
}
