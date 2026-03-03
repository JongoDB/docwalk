#!/usr/bin/env bash
# DocWalk Self-Hosted Runner — LXC Setup Script
#
# Run inside a fresh Ubuntu 24.04 LXC container on Proxmox.
# Installs Node 20, Python 3.12, Zensical, and the GitHub Actions runner.
#
# Prerequisites:
#   - Ubuntu 24.04 LXC (unprivileged recommended)
#   - 2+ CPU cores, 2GB+ RAM, 10GB disk
#   - Outbound HTTPS access (GitHub, Groq API)
#   - No inbound ports needed
#
# Usage:
#   1. Create LXC:  pct create 200 local:vztmpl/ubuntu-24.04-standard_24.04-2_amd64.tar.zst \
#                     --hostname docwalk-runner --memory 2048 --cores 2 --rootfs local-lvm:10 \
#                     --net0 name=eth0,bridge=vmbr0,ip=dhcp --unprivileged 1
#   2. Start:       pct start 200
#   3. Enter:       pct enter 200
#   4. Run:         curl -fsSL <this-script-url> | bash
#      OR copy this script in and run: bash setup-runner.sh
#
# After setup, configure the runner interactively:
#   cd /opt/actions-runner && ./config.sh --url https://github.com/JongoDB/docwalk --token <TOKEN>
#   Then start: ./run.sh  (or install as service — see bottom of script)
#
# Security notes:
#   - Only allow workflow_dispatch triggers — never run on PR events from forks
#   - Use a dedicated Groq API key with usage alerts
#   - The runner only needs: contents:write on the repo (for gh-pages push)
#   - Unprivileged LXC provides reasonable isolation from the Proxmox host

set -euo pipefail

echo "==> DocWalk self-hosted runner setup"
echo "    Target: Ubuntu 24.04 LXC on Proxmox"
echo ""

# ── System packages ──────────────────────────────────────────────────────────

echo "==> Installing system dependencies..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
  curl ca-certificates git jq \
  python3 python3-pip python3-venv \
  build-essential libicu-dev

# ── Node.js 20 (via NodeSource) ─────────────────────────────────────────────

echo "==> Installing Node.js 20..."
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
echo "    Node $(node -v), npm $(npm -v)"

# ── Python / Zensical ───────────────────────────────────────────────────────

echo "==> Installing Zensical (MkDocs Material superset)..."
pip install --break-system-packages zensical
echo "    Zensical $(zensical --version 2>/dev/null || echo 'installed')"

# ── DocWalk dependencies (pre-installed for speed) ───────────────────────────

echo "==> Pre-installing DocWalk npm dependencies..."
DOCWALK_DEPS=/opt/docwalk-deps
mkdir -p "$DOCWALK_DEPS"

# Clone just package.json + package-lock.json for npm ci
cd "$DOCWALK_DEPS"
if [ ! -f package.json ]; then
  # Fetch just the dependency manifests from the repo
  curl -fsSL "https://raw.githubusercontent.com/JongoDB/docwalk/master/package.json" -o package.json
  curl -fsSL "https://raw.githubusercontent.com/JongoDB/docwalk/master/package-lock.json" -o package-lock.json
fi
npm ci --ignore-scripts
echo "    npm dependencies installed to $DOCWALK_DEPS/node_modules"

# ── Create runner user ───────────────────────────────────────────────────────

echo "==> Creating runner user..."
if ! id runner &>/dev/null; then
  useradd -m -s /bin/bash runner
fi

# ── GitHub Actions Runner ────────────────────────────────────────────────────

RUNNER_VERSION="2.321.0"
RUNNER_DIR="/opt/actions-runner"

echo "==> Installing GitHub Actions runner v${RUNNER_VERSION}..."
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"

if [ ! -f run.sh ]; then
  ARCH=$(dpkg --print-architecture)
  case "$ARCH" in
    amd64) RUNNER_ARCH="x64" ;;
    arm64) RUNNER_ARCH="arm64" ;;
    *) echo "Unsupported arch: $ARCH"; exit 1 ;;
  esac

  RUNNER_URL="https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-${RUNNER_ARCH}-${RUNNER_VERSION}.tar.gz"
  curl -fsSL "$RUNNER_URL" -o runner.tar.gz
  tar xzf runner.tar.gz
  rm runner.tar.gz

  # Install runner dependencies
  ./bin/installdependencies.sh
fi

chown -R runner:runner "$RUNNER_DIR"

# ── Environment variables ────────────────────────────────────────────────────

echo "==> Setting up environment..."
ENVFILE="/home/runner/.env"
cat > "$ENVFILE" << 'ENVEOF'
# DocWalk runner environment
# Add your Groq API key here:
# GROQ_API_KEY=gsk_...
#
# The runner picks these up automatically for all workflow jobs.
ENVEOF
chown runner:runner "$ENVFILE"

# ── Update script ────────────────────────────────────────────────────────────

cat > /opt/docwalk-update-deps.sh << 'UPDATEEOF'
#!/usr/bin/env bash
# Run periodically to keep pre-installed deps in sync with the repo.
set -euo pipefail
cd /opt/docwalk-deps
curl -fsSL "https://raw.githubusercontent.com/JongoDB/docwalk/master/package.json" -o package.json
curl -fsSL "https://raw.githubusercontent.com/JongoDB/docwalk/master/package-lock.json" -o package-lock.json
npm ci --ignore-scripts
echo "DocWalk dependencies updated at $(date)"
UPDATEEOF
chmod +x /opt/docwalk-update-deps.sh

# ── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "  1. Get a runner registration token:"
echo "     Go to: https://github.com/JongoDB/docwalk/settings/actions/runners/new"
echo "     Or run: gh api repos/JongoDB/docwalk/actions/runners/registration-token -q .token"
echo ""
echo "  2. Configure the runner (as the runner user):"
echo "     su - runner"
echo "     cd /opt/actions-runner"
echo "     ./config.sh --url https://github.com/JongoDB/docwalk --token <TOKEN> --labels docwalk-runner"
echo ""
echo "  3. (Optional) Add your Groq API key:"
echo "     echo 'GROQ_API_KEY=gsk_...' >> /home/runner/.env"
echo ""
echo "  4. Install as a systemd service (auto-start on boot):"
echo "     cd /opt/actions-runner"
echo "     sudo ./svc.sh install runner"
echo "     sudo ./svc.sh start"
echo ""
echo "  5. Or run interactively for testing:"
echo "     su - runner -c 'cd /opt/actions-runner && ./run.sh'"
echo ""
echo "  To update pre-installed deps later:"
echo "     /opt/docwalk-update-deps.sh"
echo ""
