#!/usr/bin/env bash
#
# generate-build-sheet.sh
#
# Single-file wrapper around the `builds` command of the dbd-sheet CLI, run
# from its Docker image via scripts/dbd-sheet.sh (see
# public/images/builds/README.md). Renders one build-sheet PNG (a picked
# killer or survivor loadout) from a single source yaml file, auto-resolving
# the output directory (and killer/format) from the file's own path under
# src/data/balancing/<format>/<killer>/<file>.yaml — no --out bookkeeping
# needed.
#
# When the killer's <killer>-build.yaml allow-list exists alongside the
# input file, it is automatically passed as --rules so the picked loadout
# gets cross-validated against it for free.
#
# Usage:
#   scripts/generate-build-sheet.sh <yaml-file> [options]
#
# Run with --help for the full option list.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SRC_BASE="$REPO_ROOT/src/data/balancing"
OUT_BASE="$REPO_ROOT/public/images/builds"

SHEET="$REPO_ROOT/scripts/dbd-sheet.sh"

VALID_FORMATS=(1v4-quartet 1v4-duo 1v1)

YAML_ARG=""
ICONS_ONLY=false
DRY_RUN=false

print_usage() {
  cat <<'EOF'
Usage: scripts/generate-build-sheet.sh <yaml-file> [options]

Renders one build-sheet PNG (a picked killer or survivor loadout) from a
single <killer>-*.yaml source file, auto-resolving the output directory and
killer name from the file's own path under
src/data/balancing/<format>/<killer>/.

Options:
  --icons-only   Pass through to `dbd-sheet builds` (also emit a transparent
                 text-free icon-strip PNG).
  --dry-run      Print the command that would run, without running it.
  -h, --help     Show this help.

Examples:
  scripts/generate-build-sheet.sh src/data/balancing/1v4-quartet/ghoul/ghoul-survivors-build.yaml
  scripts/generate-build-sheet.sh --dry-run src/data/balancing/1v4-quartet/lich/lich-killer-build.yaml

Env:
  DBD_SHEET_IMAGE   Generator image (default:
                    ghcr.io/shenapse/dbd-balancing-sheet-generator:main).
                    See scripts/dbd-sheet.sh.

For bulk regeneration across many killers/formats, use
scripts/generate-build-sheets.sh --type build-sheet instead.
EOF
}

die() {
  echo "Error: $*" >&2
  echo "Run '$0 --help' for usage." >&2
  exit 1
}

# --- arg parsing -------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --icons-only)
      ICONS_ONLY=true; shift ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    -h|--help)
      print_usage; exit 0 ;;
    -*)
      die "Unknown option: $1" ;;
    *)
      [[ -z "$YAML_ARG" ]] || die "Only one yaml file may be given, got both '$YAML_ARG' and '$1'"
      YAML_ARG="$1"; shift ;;
  esac
done

[[ -n "$YAML_ARG" ]] || die "Missing required <yaml-file> argument."
[[ -f "$YAML_ARG" ]] || die "File not found: $YAML_ARG"

yaml_path="$(cd "$(dirname "$YAML_ARG")" && pwd -P)/$(basename "$YAML_ARG")"

killer="$(basename "$(dirname "$yaml_path")")"
format="$(basename "$(dirname "$(dirname "$yaml_path")")")"

valid_format=false
for v in "${VALID_FORMATS[@]}"; do
  [[ "$format" == "$v" ]] && valid_format=true && break
done
expected_dir="$SRC_BASE/$format/$killer"
if [[ "$valid_format" != true || "$(dirname "$yaml_path")" != "$expected_dir" ]]; then
  die "'$YAML_ARG' is not under src/data/balancing/<format>/<killer>/ (expected a path like" \
      "src/data/balancing/{${VALID_FORMATS[*]}}/<killer>/<file>.yaml) — cannot resolve format/killer."
fi

out_dir="$OUT_BASE/$format/$killer"
restriction_yaml="$SRC_BASE/$format/$killer/${killer}-build.yaml"

cmd=("$SHEET" builds "$yaml_path" --out "$out_dir")
[[ -f "$restriction_yaml" ]] && cmd+=(--rules "$restriction_yaml")
[[ "$ICONS_ONLY" == true ]] && cmd+=(--icons-only)

echo "==> build-sheet: $(basename "$yaml_path") -> $out_dir"
if [[ "$DRY_RUN" == true ]]; then
  printf '  %q ' "${cmd[@]}"
  echo
else
  mkdir -p "$out_dir"
  "${cmd[@]}"
fi
