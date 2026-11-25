#!/usr/bin/env bash
#
# dbd-sheet.sh
#
# Runs the `dbd-sheet` CLI of balancing-sheet-generator
# (https://github.com/shenapse/dbd-balancing-sheet-generator) from its Docker
# image. Game data and icons are baked into the image, so nothing outside this
# repo is needed besides Docker.
#
# The repo root is bind-mounted at /work and the container starts in the same
# relative directory as the caller, so repo-relative (or cwd-relative) paths
# work as-is. Absolute host paths under the repo root are rewritten to their
# /work/... equivalent. Paths outside the repo are not visible to the tool.
# Files are written as the calling user.
#
# Usage:
#   scripts/dbd-sheet.sh <perks|addons|items|builds|version> [files...] [options]
#   scripts/dbd-sheet.sh --help
#
# Env:
#   DBD_SHEET_IMAGE     Image to run (default:
#                       ghcr.io/shenapse/dbd-balancing-sheet-generator:main).
#                       Set a version or sha-<short> tag for reproducible output.
#   SOURCE_DATE_EPOCH   Passed through when set: fixes the date printed on the
#                       sheets.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
IMAGE="${DBD_SHEET_IMAGE:-ghcr.io/shenapse/dbd-balancing-sheet-generator:main}"

die() {
  echo "Error: $*" >&2
  exit 2
}

command -v docker >/dev/null 2>&1 || die "docker not found — the sheet generator runs from the Docker image $IMAGE."

# `npm run` always starts scripts in the package root; INIT_CWD is where the
# caller actually was, so cwd-relative paths still resolve.
if [[ -n "${npm_lifecycle_event:-}" && -n "${INIT_CWD:-}" ]]; then
  cwd="$(cd "$INIT_CWD" && pwd -P)"
else
  cwd="$(pwd -P)"
fi
case "$cwd" in
  "$REPO_ROOT")   workdir=/work ;;
  "$REPO_ROOT"/*) workdir="/work${cwd#"$REPO_ROOT"}" ;;
  *)              die "run from inside the repo ($REPO_ROOT): only the repo is mounted into the container." ;;
esac

args=()
for a in "$@"; do
  case "$a" in
    "$REPO_ROOT")   args+=(/work) ;;
    "$REPO_ROOT"/*) args+=("/work${a#"$REPO_ROOT"}") ;;
    *)              args+=("$a") ;;
  esac
done

env_args=()
[[ -n "${SOURCE_DATE_EPOCH:-}" ]] && env_args+=(-e "SOURCE_DATE_EPOCH=$SOURCE_DATE_EPOCH")

exec docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$REPO_ROOT:/work" \
  -w "$workdir" \
  "${env_args[@]}" \
  "$IMAGE" "${args[@]}"
