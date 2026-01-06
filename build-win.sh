#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

CERT_PATH="assets/appear-offline-cert.pem"
KEY_PATH="assets/appear-offline-key.pem"
NSIS_SCRIPT_PATH="nsis/installer.nsi"
ICON_PATH="assets/icon.ico"

is_windows_shell() {
  case "$(uname -s 2>/dev/null || true)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

is_wsl() {
  [[ -n "${WSL_INTEROP-}" || -n "${WSL_DISTRO_NAME-}" ]] && return 0
  grep -qi microsoft /proc/sys/kernel/osrelease 2>/dev/null && return 0
  return 1
}

detect_env() {
  if is_windows_shell; then
    echo "windows"
    return
  fi
  if is_wsl; then
    echo "wsl"
    return
  fi
  echo "linux"
}

ensure_tls_certs() {
  if ! command -v openssl >/dev/null 2>&1; then
    echo "ERROR: openssl not found; required to generate Appear Offline TLS certs." >&2
    exit 1
  fi

  local needs_generate="false"

  if [[ ! -f "$CERT_PATH" || ! -f "$KEY_PATH" ]]; then
    needs_generate="true"
  else
    if ! openssl x509 -in "$CERT_PATH" -noout -text 2>/dev/null | grep -q "IP Address:127.0.0.1"; then
      needs_generate="true"
    fi
  fi

  if [[ "$needs_generate" == "true" ]]; then
    echo "Generating Appear Offline TLS certificate..."
    rm -f "$CERT_PATH" "$KEY_PATH"

    openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
      -keyout "$KEY_PATH" \
      -out "$CERT_PATH" \
      -days 3650 \
      -subj "/CN=127.0.0.1" \
      -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" >/dev/null 2>&1 \
      || openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
        -keyout "$KEY_PATH" \
        -out "$CERT_PATH" \
        -days 3650 \
        -subj "/CN=127.0.0.1" >/dev/null 2>&1
  fi
}

require_file() {
  local file="$1"
  local hint="${2-}"
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Missing required file: $file" >&2
    if [[ -n "$hint" ]]; then
      echo "  $hint" >&2
    fi
    exit 1
  fi
}

find_windows_main_exe() {
  local exe
  local exe_count

  exe_count="$(find "dist/win-unpacked" -maxdepth 1 -type f -name "*.exe" | wc -l | tr -d ' ')"
  if [[ "$exe_count" != "1" ]]; then
    echo "ERROR: Expected exactly 1 main .exe in dist/win-unpacked, found $exe_count." >&2
    find "dist/win-unpacked" -maxdepth 1 -type f -name "*.exe" -print >&2
    exit 1
  fi

  exe="$(find "dist/win-unpacked" -maxdepth 1 -type f -name "*.exe" | head -n 1)"
  echo "$exe"
}

edit_windows_exe_resources() {
  local exe_path="$1"

  require_file "$exe_path"
  require_file "$ICON_PATH" "Ensure the icon exists at $ICON_PATH"

  local app_builder="node_modules/app-builder-bin/linux/x64/app-builder"
  if is_windows_shell; then
    app_builder="node_modules/app-builder-bin/win/x64/app-builder.exe"
  fi

  require_file "$app_builder" "Run 'npm install' to restore dependencies."

  local args_json
  args_json="$(node -e "
    const pkg = require('./package.json');
    const build = pkg.build || {};
    const productName = build.productName || pkg.name || 'app';
    const win = build.win || {};
    const rawVersion = pkg.version || '0.0.0';
    const numericVersion = rawVersion.split('-')[0];
    const versionParts = numericVersion
      .split('.')
      .map(part => Number.parseInt(part, 10))
      .filter(part => Number.isFinite(part) && part >= 0);
    while (versionParts.length < 4) versionParts.push(0);
    const windowsVersion = versionParts.slice(0, 4).join('.');
    const author = pkg.author;
    const companyName = typeof author === 'string' ? author : (author && author.name) ? author.name : '';
    const requestedExecutionLevel = win.requestedExecutionLevel || 'asInvoker';

    const exe = process.argv[1];
    const icon = process.argv[2];
    const args = [
      exe,
      '--set-version-string', 'FileDescription', productName,
      '--set-version-string', 'ProductName', productName,
      '--set-file-version', windowsVersion,
      '--set-product-version', windowsVersion,
    ];

    if (companyName) {
      args.push('--set-version-string', 'CompanyName', companyName);
    }

    if (requestedExecutionLevel && requestedExecutionLevel !== 'asInvoker') {
      args.push('--set-requested-execution-level', requestedExecutionLevel);
    }

    args.push('--set-icon', icon);
    process.stdout.write(JSON.stringify(args));
  " "$exe_path" "$ICON_PATH")"

  echo "Applying icon/metadata to: $exe_path"
  "$app_builder" rcedit --args "$args_json"
}

usage() {
  cat <<'EOF'
Usage: ./build-win.sh [--no-clean] [--portable-only] [--setup-only]

Builds Windows artifacts into dist/:
  - Portable (.exe)
  - Setup (NSIS installer)

Notes:
  - On Linux/WSL, builds run without wine by:
    1) Packing with signAndEditExecutable disabled
    2) Applying icon/metadata using app-builder rcedit
    3) Building installers from --prepackaged output
EOF
}

NO_CLEAN="false"
PORTABLE_ONLY="false"
SETUP_ONLY="false"

for arg in "$@"; do
  case "$arg" in
    --no-clean) NO_CLEAN="true" ;;
    --portable-only) PORTABLE_ONLY="true" ;;
    --setup-only) SETUP_ONLY="true" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $arg" >&2; usage; exit 2 ;;
  esac
done

if [[ "$PORTABLE_ONLY" == "true" && "$SETUP_ONLY" == "true" ]]; then
  echo "ERROR: --portable-only and --setup-only are mutually exclusive." >&2
  exit 2
fi

ENV_KIND="$(detect_env)"
echo "Environment: $ENV_KIND"

ensure_tls_certs

if [[ "$NO_CLEAN" != "true" ]]; then
  rm -rf dist
fi

if [[ "$ENV_KIND" == "windows" ]]; then
  if [[ "$SETUP_ONLY" != "true" ]]; then
    echo "Building Windows portable..."
    npx electron-builder --win portable
  fi

  if [[ "$PORTABLE_ONLY" == "true" ]]; then
    echo "OK: Portable build complete (see dist/)."
    exit 0
  fi

  echo "Building Windows setup (NSIS)..."
  npx electron-builder --win nsis

  echo "OK: Builds are in dist/"
  exit 0
fi

echo "Packing Windows app (unpacked)..."
npx electron-builder --win --dir -c.win.signAndEditExecutable=false

main_exe="$(find_windows_main_exe)"
edit_windows_exe_resources "$main_exe"

if [[ "$PORTABLE_ONLY" == "true" ]]; then
  echo "Building Windows portable..."
  npx electron-builder --win portable --prepackaged dist/win-unpacked -c.win.signAndEditExecutable=false
  echo "OK: Portable build complete (see dist/)."
  exit 0
fi

if [[ "$SETUP_ONLY" != "true" ]]; then
  echo "Building Windows portable..."
  npx electron-builder --win portable --prepackaged dist/win-unpacked -c.win.signAndEditExecutable=false
fi

echo "Building Windows setup (NSIS)..."
require_file "$NSIS_SCRIPT_PATH" "This file is required for wine-free NSIS builds on Linux/WSL."
npx electron-builder --win nsis --prepackaged dist/win-unpacked -c.win.signAndEditExecutable=false -c.nsis.script="$NSIS_SCRIPT_PATH"

echo "OK: Builds are in dist/"
