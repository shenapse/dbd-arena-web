# Build Sheets

This README explains how to generate the build sheets shown on the site. There are two
categories: **restriction sheets** — killer/survivor perk sheets, killer add-on sheets,
and survivor item sheets, rendering an allow/deny list — and **build sheets**, rendering
one specific, already-picked loadout.

The **source YAML** (`*-build.yaml`, the single source of truth for per-killer balancing)
lives under `src/data/balancing/<format>/<killer>/`, e.g.
`src/data/balancing/1v4-quartet/blight/blight-build.yaml`. The generated PNG sheets in
this directory are the served output of those files.

## Prerequisites

- `npm install` at the repo root — the four generator CLIs (`dbd-perk-sheet`,
  `dbd-addon-sheet`, `dbd-item-sheet`, `dbd-build-sheet`) are pulled in as
  `optionalDependencies` from `balancing-tool` repo.
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

## Build sheets

`dbd-build-sheet` is different in kind from the three generators above. Where those
render an allow/deny **restriction list** ("here's everything you're allowed to
bring"), `dbd-build-sheet` renders one specific, already-picked **loadout** ("here's
exactly what this player/team brought") — a concrete set of perks + item + add-ons +
offering, one row per build, as a PNG. It has no `--preset` flag (a concrete build has
no allow-list to compile) and no `--columns` flag (row layout is fixed).

**Source YAML naming** differs from the mandatory `<killer>-build.yaml` above: build
sheets are sourced from `<killer>-killer-builds.yaml` and
`<killer>-survivor-builds.yaml` (plural "builds", split by side), living in the same
`src/data/balancing/<format>/<killer>/` directory. Both files are **optional** — a
killer may have neither, either, or both.

**Cross-validation against the killer's allow-list**: `dbd-build-sheet` accepts an
optional `--rules <file.yaml>` flag that checks the picked build against an allow-list
file and flags any violations on the rendered sheet. `scripts/generate-build-sheets.sh
--type build-sheet` passes `--rules <killer>-build.yaml` automatically whenever that
file exists for the same killer, so bulk-generated build sheets get validated against
that killer's existing allow/deny rules for free.

```bash
scripts/generate-build-sheets.sh --type build-sheet         # every killer, bulk
scripts/generate-build-sheets.sh --killer blight --type build-sheet
```

Most killers won't have build-sheet source files authored yet. In bulk/`--killer all`
mode, `generate-build-sheets.sh` silently skips any killer with neither
`<killer>-killer-builds.yaml` nor `<killer>-survivor-builds.yaml`; asking for a single
killer's build-sheet explicitly when it has neither file is an error.

For a single file, use the raw `generate:build-sheet` npm script directly, same pattern
as `generate:perks` / `generate:addons` / `generate:items` above:

```bash
npm run generate:build-sheet src/data/balancing/1v4-quartet/blight/blight-killer-builds.yaml -- --out public/images/builds/1v4-quartet/blight
```

Or, to skip figuring out `--out` (and `--rules`) by hand, use
`scripts/generate-build-sheet.sh` — it resolves the format/killer and the matching
`<killer>-build.yaml` allow-list straight from the input file's own path:

```bash
scripts/generate-build-sheet.sh src/data/balancing/1v4-quartet/blight/blight-killer-builds.yaml
```

See the [`dbd-build-sheet` README](../../../node_modules/dbd-build-sheet-generator/README.md)
for the full YAML schema and CLI flags.

## Authoring the YAML

This README covers **running** the generators. The YAML schema — `allow`/`deny`
precedence, selectors (rarity/tier/tag groups, colon-name quoting), and the image-only
limit families (combination bans, duplicate/repetition limits, pick limits) — is
documented tool-side. Refer to the generator READMEs:

- [`dbd-perk-sheet` (perk allow-lists)](../../../node_modules/dbd-perk-sheet-generator/README.md)
- [`dbd-addon-sheet` (add-on allow-lists)](../../../node_modules/dbd-addon-sheet-generator/README.md)
- [`dbd-item-sheet` (item allow-lists)](../../../node_modules/dbd-item-sheet-generator/README.md)
- [`dbd-build-sheet` (concrete build sheets)](../../../node_modules/dbd-build-sheet-generator/README.md)