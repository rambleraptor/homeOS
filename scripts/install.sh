#!/usr/bin/env bash
# Homestead binary installer.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash
#
# Environment overrides:
#   HOMESTEAD_VERSION       Release tag to install (default: latest)
#   HOMESTEAD_INSTALL_DIR   Install directory (default: ~/.local/bin)
#   HOMESTEAD_REPO          GitHub repo owner/name (default: rambleraptor/homestead)
#
# The installer downloads a prebuilt release asset, verifies it with
# SHA256SUMS, installs the `homestead` binary, and prints the next commands.

set -euo pipefail

HOMESTEAD_REPO="${HOMESTEAD_REPO:-rambleraptor/homestead}"
HOMESTEAD_VERSION="${HOMESTEAD_VERSION:-latest}"
HOMESTEAD_INSTALL_DIR="${HOMESTEAD_INSTALL_DIR:-$HOME/.local/bin}"

if [[ -t 1 ]]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GRN=$'\033[32m'; YLW=$'\033[33m'; RST=$'\033[0m'
else
  BOLD=''; DIM=''; RED=''; GRN=''; YLW=''; RST=''
fi

log()  { printf '%s==>%s %s\n' "$BOLD" "$RST" "$*"; }
warn() { printf '%s==>%s %s\n' "$YLW" "$RST" "$*" >&2; }
fail() { printf '%serror:%s %s\n' "$RED" "$RST" "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || fail "missing prerequisite: $1"; }

usage() {
  cat <<EOF
Install Homestead from a prebuilt GitHub Release binary.

Usage:
  curl -fsSL https://raw.githubusercontent.com/rambleraptor/homestead/main/scripts/install.sh | bash

Environment:
  HOMESTEAD_VERSION       Release tag to install, e.g. v0.1.0 (default: latest)
  HOMESTEAD_INSTALL_DIR   Install directory (default: ~/.local/bin)
  HOMESTEAD_REPO          GitHub repo owner/name (default: rambleraptor/homestead)
EOF
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  '')
    ;;
  *)
    fail "unknown argument: $1"
    ;;
esac

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="darwin" ;;
    *) fail "unsupported OS: $os" ;;
  esac

  case "$arch" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) fail "unsupported architecture: $arch" ;;
  esac

  printf '%s-%s' "$os" "$arch"
}

download() {
  local url="$1"
  local dest="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget >/dev/null 2>&1; then
    wget -q "$url" -O "$dest"
  else
    fail "missing prerequisite: curl or wget"
  fi
}

verify_checksum() {
  local sums_file="$1"
  local asset_file="$2"
  local asset_name
  asset_name="$(basename "$asset_file")"

  if command -v sha256sum >/dev/null 2>&1; then
    (cd "$(dirname "$asset_file")" && grep "  $asset_name\$" "$sums_file" | sha256sum -c -)
  elif command -v shasum >/dev/null 2>&1; then
    (cd "$(dirname "$asset_file")" && grep "  $asset_name\$" "$sums_file" | shasum -a 256 -c -)
  else
    fail "missing prerequisite: sha256sum or shasum"
  fi
}

need tar
need mktemp

platform="$(detect_platform)"
asset="homestead-${platform}.tar.gz"

if [[ "$HOMESTEAD_VERSION" = "latest" ]]; then
  release_base="https://github.com/${HOMESTEAD_REPO}/releases/latest/download"
  version_label="latest"
else
  release_base="https://github.com/${HOMESTEAD_REPO}/releases/download/${HOMESTEAD_VERSION}"
  version_label="$HOMESTEAD_VERSION"
fi

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

log "Installing Homestead ${version_label} for ${platform}"
download "${release_base}/${asset}" "${tmpdir}/${asset}"
download "${release_base}/SHA256SUMS" "${tmpdir}/SHA256SUMS"

log "Verifying checksum"
verify_checksum "${tmpdir}/SHA256SUMS" "${tmpdir}/${asset}"

log "Installing binary to ${HOMESTEAD_INSTALL_DIR}"
mkdir -p "$HOMESTEAD_INSTALL_DIR"
tar -xzf "${tmpdir}/${asset}" -C "$tmpdir"
install -m 0755 "${tmpdir}/homestead" "${HOMESTEAD_INSTALL_DIR}/homestead"

if [[ ":$PATH:" = *":${HOMESTEAD_INSTALL_DIR}:"* ]]; then
  homestead_cmd="homestead"
else
  homestead_cmd="${HOMESTEAD_INSTALL_DIR}/homestead"
  warn "${HOMESTEAD_INSTALL_DIR} is not on PATH."
  warn "Add it with: export PATH=\"${HOMESTEAD_INSTALL_DIR}:\$PATH\""
fi

cat <<EOF

${GRN}✓ Homestead installed:${RST} ${HOMESTEAD_INSTALL_DIR}/homestead

Next steps:
  ${BOLD}${homestead_cmd} init my-home${RST}
  ${BOLD}cd my-home${RST}
  ${BOLD}${homestead_cmd} start${RST}

Then open http://localhost:3000 and log in with the superuser credentials
printed by \`homestead start\`.

${DIM}Install a specific version with HOMESTEAD_VERSION=v0.1.0.${RST}
EOF
