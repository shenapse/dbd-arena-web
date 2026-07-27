# Build Sheets

This REAME explains how to generate **build-restriction sheets** shown on the site — the
killer/survivor perk sheets, killer add-on sheets, and survivor item sheets.

The **source YAML** (`*-build.yaml`, the single source of truth for per-killer balancing)
lives under `src/data/balancing/<format>/<killer>/`, e.g.
`src/data/balancing/1v4-quartet/blight/blight-build.yaml`. The generated PNG sheets in
this directory are the served output of those files.

## Prerequisites

- `npm install` at the repo root — the three generator CLIs (`dbd-perk-sheet`,
  `dbd-addon-sheet`, `dbd-item-sheet`) are pulled in as `optionalDependencies` from `balancing-tool` repo.
- see `package.json` for info about `balancing-tool` repo

## Generating sheets

**Bulk regeneration**: `scripts/generate-build-sheets.sh` wraps the CLIs below and loops
over killers/formats/sheet types for you, defaulting to every killer and every sheet type
for `1v4-quartet`:

```bash
scripts/generate-build-sheets.sh                                   # everything, 1v4-quartet
scripts/generate-build-sheets.sh --killer blight --type perks      # one killer, one type
scripts/generate-build-sheets.sh --format 1v4-duo --type addons,items
scripts/generate-build-sheets.sh --dry-run                         # preview without writing
```

Run `scripts/generate-build-sheets.sh --help` for the full option list. For single-file
runs, ad-hoc `--preset` aggregation across an explicit multi-killer batch, or other
one-off invocations, use the raw `generate:*` scripts directly as described below.

The `generate:*` scripts (see `package.json`) wrap each CLI with the default asset root.
They do **not** auto-discover files — pass the target YAML path(s) after `--`. Run from
the repo root:

```bash
# regenerate every sheet for one killer (Blight, 1v4 quartet)
npm run generate:perks src/data/balancing/1v4-quartet/blight/blight-build.yaml -- --out public/images/builds/1v4-quartet/blight
npm run generate:addons src/data/balancing/1v4-quartet/blight/blight-build.yaml -- --out public/images/builds/1v4-quartet/blight
npm run generate:items src/data/balancing/1v4-quartet/blight/blight-build.yaml -- --out public/images/builds/1v4-quartet/blight
```

- **`--out` is required.** The generators write output next to the input YAML by default,
  but the source YAML now lives under `src/data/balancing/` while the served sheets belong
  here under `public/images/builds/<format>/<killer>/` — so always pass the matching
  `-- --out <dir>`.
- **Pass multiple YAML paths at once** to batch several killers in one run.
- Add `-- --preset <out.json>` to also emit an aggregated BbD balancing-preset JSON.

One `*-build.yaml` per killer holds **all** the sections — `killerPerks` /
`survivorPerks`, `addons`, and `items`. Each generator reads only the sections it cares
about, so the same file feeds all three scripts. PNG filenames use the killer's `Name`
with spaces turned into dashes (`killer: The Blight` → `The-Blight-*.png`).

## Authoring the YAML

This README covers **running** the generators. The YAML schema — `allow`/`deny`
precedence, selectors (rarity/tier/tag groups, colon-name quoting), and the image-only
limit families (combination bans, duplicate/repetition limits, pick limits) — is
documented tool-side. Refer to the generator READMEs: