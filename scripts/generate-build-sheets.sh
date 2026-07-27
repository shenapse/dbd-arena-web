#!/usr/bin/env bash
#
# generate-build-sheets.sh
#
# Wraps the dbd-perk-sheet / dbd-addon-sheet / dbd-item-sheet CLIs (see
# public/images/builds/README.md) to bulk-regenerate build-restriction sheet
# PNGs from the per-killer *-build.yaml source files under
# src/data/balancing/<format>/<killer>/, writing them to
# public/images/builds/<format>/<killer>/ by default.
#
# Usage:
#   scripts/generate-build-sheets.sh [options]
#
# Run with --help for the full option list.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_BASE="$REPO_ROOT/src/data/balancing"
OUT_BASE="$REPO_ROOT/public/images/builds"
ASSET_ROOT="${DBD_BALANCING_TOOL_ROOT:-$REPO_ROOT/../../../balancing-tool}"

PERK_BIN="$REPO_ROOT/node_modules/.bin/dbd-perk-sheet"
ADDON_BIN="$REPO_ROOT/node_modules/.bin/dbd-addon-sheet"
ITEM_BIN="$REPO_ROOT/node_modules/.bin/dbd-item-sheet"

VALID_FORMATS=(1v4-quartet 1v4-duo 1v1)
VALID_TYPES=(perks addons items)

FORMAT="1v4-quartet"
KILLER_ARG="all"
TYPE_ARG="all"
OUT_OVERRIDE=""
PRESET_PATH=""
DRY_RUN=false

print_usage() {
  cat <<'EOF'
Usage: scripts/generate-build-sheets.sh [options]

Regenerates build-restriction sheet PNGs (killer/survivor perks, killer
add-ons, survivor items) from the source YAML under src/data/balancing/,
wrapping the dbd-perk-sheet / dbd-addon-sheet / dbd-item-sheet CLIs.

Options:
  --format <fmt>        1v4-quartet | 1v4-duo | 1v1   (default: 1v4-quartet)
  --killer <slug|all>   Killer directory slug, or 'all' for every killer in
                         the format. Ignored for --format 1v1 (there is only
                         one unit, 'base').             (default: all)
  --type <t[,t..]|all>  perks | addons | items | all, comma-separated combos
                         allowed (e.g. addons,items). Note: 'perks' always
                         generates BOTH killer-perks and survivor-perks
                         images in a single call — they cannot be split.
                                                         (default: all)
  --out <dir>            Override the output directory for every unit
                         processed (default per killer:
                         public/images/builds/<format>/<killer>).
                         WARNING: combined with --killer all, every killer's
                         output is written into this SAME directory.
  --preset <path>        Pass-through --preset to the generator CLI(s).
  --dry-run              Print the commands that would run, without running
                         them.
  -h, --help              Show this help.

Examples:
  # Regenerate everything for every killer, 1v4 quartet (default)
  scripts/generate-build-sheets.sh

  # Just Blight's perk sheets
  scripts/generate-build-sheets.sh --killer blight --type perks

  # Addons + items for every 1v4-duo killer
  scripts/generate-build-sheets.sh --format 1v4-duo --type addons,items

  # 1v1 base build, all sheet types
  scripts/generate-build-sheets.sh --format 1v1

Env:
  DBD_BALANCING_TOOL_ROOT   Path to the balancing-tool checkout (default:
                             ../../../balancing-tool relative to the repo
                             root).

A failed run is safe to re-run: each generator call fully overwrites its
target files, so regeneration is idempotent.
EOF
}

die() {
  echo "Error: $*" >&2
  echo "Run '$0 --help' for usage." >&2
  exit 1
}

list_killers() {
  local fmt="$1" dir="$SRC_BASE/$1"
  local d slug
  for d in "$dir"/*/; do
    slug="$(basename "$d")"
    [[ "$slug" == "template" ]] && continue
    printf '%s\n' "$slug"
  done
}

validate_format() {
  local fmt="$1" v
  for v in "${VALID_FORMATS[@]}"; do
    [[ "$fmt" == "$v" ]] && return 0
  done
  die "Invalid --format '$fmt'. Valid values: ${VALID_FORMATS[*]}"
}

yaml_path_for() {
  local fmt="$1" slug="$2"
  if [[ "$fmt" == "1v1" ]]; then
    echo "$SRC_BASE/1v1/base/1v1-build.yaml"
  else
    echo "$SRC_BASE/$fmt/$slug/${slug}-build.yaml"
  fi
}

resolve_killers() {
  local fmt="$1" killer_arg="$2"

  if [[ "$fmt" == "1v1" ]]; then
    if [[ "$killer_arg" != "all" && "$killer_arg" != "base" ]]; then
      echo "Note: --format 1v1 has no per-killer directories; ignoring --killer '$killer_arg', using 'base'." >&2
    fi
    echo "base"
    return 0
  fi

  if [[ "$killer_arg" == "all" ]]; then
    local killers
    killers="$(list_killers "$fmt")"
    [[ -n "$killers" ]] || die "No killer directories found under $SRC_BASE/$fmt"
    echo "$killers"
    return 0
  fi

  local yaml
  yaml="$(yaml_path_for "$fmt" "$killer_arg")"
  if [[ ! -d "$SRC_BASE/$fmt/$killer_arg" || ! -f "$yaml" ]]; then
    local valid
    valid="$(list_killers "$fmt" | paste -sd, - | sed 's/,/, /g')"
    die "Unknown killer '$killer_arg' for format '$fmt'. Valid killers: $valid"
  fi
  echo "$killer_arg"
}

run_type() {
  local type="$1" yaml="$2" out_dir="$3"
  local bin
  case "$type" in
    perks)  bin="$PERK_BIN" ;;
    addons) bin="$ADDON_BIN" ;;
    items)  bin="$ITEM_BIN" ;;
    *) die "internal error: unknown type '$type'" ;;
  esac

  local cmd=("$bin" "$yaml" --asset-root "$ASSET_ROOT" --out "$out_dir")
  [[ -n "$PRESET_PATH" ]] && cmd+=(--preset "$PRESET_PATH")

  echo "==> $type: $(basename "$yaml") -> $out_dir"
  if [[ "$DRY_RUN" == true ]]; then
    printf '  %q ' "${cmd[@]}"
    echo
  else
    mkdir -p "$out_dir"
    "${cmd[@]}"
  fi
}

# --- arg parsing -------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --format)
      [[ $# -ge 2 ]] || die "--format requires a value"
      FORMAT="$2"; shift 2 ;;
    --killer)
      [[ $# -ge 2 ]] || die "--killer requires a value"
      KILLER_ARG="$2"; shift 2 ;;
    --type)
      [[ $# -ge 2 ]] || die "--type requires a value"
      TYPE_ARG="$2"; shift 2 ;;
    --out)
      [[ $# -ge 2 ]] || die "--out requires a value"
      OUT_OVERRIDE="$2"; shift 2 ;;
    --preset)
      [[ $# -ge 2 ]] || die "--preset requires a value"
      PRESET_PATH="$2"; shift 2 ;;
    --dry-run)
      DRY_RUN=true; shift ;;
    -h|--help)
      print_usage; exit 0 ;;
    *)
      die "Unknown option: $1" ;;
  esac
done

validate_format "$FORMAT"

TYPES=()
IFS=',' read -ra type_items <<< "$TYPE_ARG"
for t in "${type_items[@]}"; do
  if [[ "$t" == "all" ]]; then
    TYPES=("${VALID_TYPES[@]}")
    break
  fi
  valid=false
  for v in "${VALID_TYPES[@]}"; do
    [[ "$t" == "$v" ]] && valid=true && break
  done
  [[ "$valid" == true ]] || die "Invalid --type '$t'. Valid values: perks, addons, items, all (comma-separated combos allowed)."
  TYPES+=("$t")
done

if [[ ! -d "$ASSET_ROOT" ]]; then
  echo "Warning: asset root '$ASSET_ROOT' does not exist." >&2
  echo "Set DBD_BALANCING_TOOL_ROOT to your balancing-tool checkout, or ensure" >&2
  echo "../../../balancing-tool exists relative to the repo root. Continuing —" >&2
  echo "the underlying CLI will report the missing files it needs." >&2
fi

for bin_var in PERK_BIN ADDON_BIN ITEM_BIN; do
  bin_path="${!bin_var}"
  [[ -x "$bin_path" ]] || die "$bin_path not found — did you run 'npm install'? (dbd-*-sheet CLIs are optionalDependencies from the balancing-tool repo)"
done

# --- main ----------------------------------------------------------------

# Captured via $(...) rather than process substitution so that a die() inside
# resolve_killers (running in the command-substitution subshell) still trips
# `set -e` and aborts the script, instead of silently yielding an empty list.
killers_output="$(resolve_killers "$FORMAT" "$KILLER_ARG")"

while IFS= read -r slug; do
  yaml="$(yaml_path_for "$FORMAT" "$slug")"
  [[ -f "$yaml" ]] || die "Expected YAML not found: $yaml"
  out_dir="${OUT_OVERRIDE:-$OUT_BASE/$FORMAT/$slug}"
  for t in "${TYPES[@]}"; do
    run_type "$t" "$yaml" "$out_dir"
  done
done <<< "$killers_output"
