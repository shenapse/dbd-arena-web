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

- **Docker.** The sheets are rendered by
  [balancing-sheet-generator](https://github.com/shenapse/dbd-balancing-sheet-generator),
  which ships only as the Docker image
  `ghcr.io/shenapse/dbd-balancing-sheet-generator`. Game data and icons
  ([dbd-assets](https://github.com/shenapse/dbd-assets)) are baked into the image, so no
  other checkout or `npm install` step is needed.
- `scripts/dbd-sheet.sh` runs the image's `dbd-sheet` CLI with the repo root mounted at
  `/work`, as your own uid. Any path you pass must be inside the repo.
- The default tag is `main` (rolling: newest tool and game data). Run
  `docker pull ghcr.io/shenapse/dbd-balancing-sheet-generator:main` to pick up new game
  data. To pin a version, set `DBD_SHEET_IMAGE` to a version or `sha-<short>` tag:

  ```bash
  DBD_SHEET_IMAGE=ghcr.io/shenapse/dbd-balancing-sheet-generator:1.2.3 scripts/generate-build-sheets.sh
  ```

- `npm run sheet -- version` prints the tool version and the dbd-assets commit in use.
- Set `SOURCE_DATE_EPOCH` (Unix seconds) to fix the date printed on the sheets.

## Generating sheets

**Bulk regeneration**: `scripts/generate-build-sheets.sh` loops over
killers/formats/sheet types for you, defaulting to every killer and every sheet type for
`1v4-quartet`:

```bash
scripts/generate-build-sheets.sh                                   # everything, 1v4-quartet
scripts/generate-build-sheets.sh --killer blight --type perks      # one killer, one type
scripts/generate-build-sheets.sh --format 1v4-duo --type addons,items
scripts/generate-build-sheets.sh --dry-run                         # preview without writing
```

Run `scripts/generate-build-sheets.sh --help` for the full option list. For single-file
runs or other one-off invocations, use the `generate:*` npm scripts directly, as described
below.

The `generate:*` scripts (see `package.json`) call `scripts/dbd-sheet.sh <command>`.
They do **not** auto-discover files: pass the target YAML path(s), with `--out` after `--`.
Run from the repo root:

```bash
# regenerate every sheet for one killer (Blight, 1v4 quartet)
npm run generate:perks src/data/balancing/1v4-quartet/blight/blight-build.yaml -- --out public/images/builds/1v4-quartet/blight
npm run generate:addons src/data/balancing/1v4-quartet/blight/blight-build.yaml -- --out public/images/builds/1v4-quartet/blight
npm run generate:items src/data/balancing/1v4-quartet/blight/blight-build.yaml -- --out public/images/builds/1v4-quartet/blight
```

- **`--out` is required.** Without it the tool writes to `./output`, but the served
  sheets belong here under `public/images/builds/<format>/<killer>/`.
- **Pass multiple YAML paths at once** to batch several killers in one run.
- Add `--json` for a machine-readable summary on stdout. Its `outputs` are container
  paths (`/work/...`): strip `/work/` to get the repo-relative path.
- `npm run sheet -- <command> ...` runs any other `dbd-sheet` command or flag.

One `*-build.yaml` per killer holds **all** the sections — `killerPerks` /
`survivorPerks`, `addons`, and `items`. Each command reads only the sections it cares
about, so the same file feeds all three scripts. PNG filenames use the killer's `Name`
with spaces turned into dashes (`killer: The Blight` → `The-Blight-*.png`).

`universe: <id>` in a YAML file resolves to `src/data/balancing/universes/<id>.yaml`: the
tool walks up from the YAML file to the nearest `universes/` directory.

## Build sheets

The `builds` command is different in kind from the three above. Where those render an
allow/deny **restriction list** ("here's everything you're allowed to bring"), `builds`
renders one specific, already-picked **loadout** ("here's exactly what this player/team
brought") — a concrete set of perks + item + add-ons + offering, one row per build, as a
PNG. It has no `--columns` flag (row layout is fixed).

**Source YAML naming** differs from the mandatory `<killer>-build.yaml` above: build
sheets are sourced from `<killer>-killer-build.yaml` and `<killer>-survivors-build.yaml`
(split by side), living in the same `src/data/balancing/<format>/<killer>/` directory.
Both files are **optional** — a killer may have neither, either, or both. Output is
`<Killer-Name>-killer-builds.png` / `<Killer-Name>-survivor-builds.png`.

**Cross-validation against the killer's allow-list**: `builds` accepts an optional
`--rules <file.yaml>` flag that checks the picked build against an allow-list file and
flags any violations on the rendered sheet (add `--strict` to also exit 1 on violations).
`scripts/generate-build-sheets.sh --type build-sheet` passes `--rules <killer>-build.yaml`
automatically whenever that file exists for the same killer, so bulk-generated build
sheets get validated against that killer's existing allow/deny rules for free.

```bash
scripts/generate-build-sheets.sh --type build-sheet         # every killer, bulk
scripts/generate-build-sheets.sh --killer blight --type build-sheet
```

Most killers won't have build-sheet source files authored yet. In bulk/`--killer all`
mode, `generate-build-sheets.sh` silently skips any killer with neither
`<killer>-killer-build.yaml` nor `<killer>-survivors-build.yaml`; asking for a single
killer's build-sheet explicitly when it has neither file is an error.

For a single file, use the raw `generate:build-sheet` npm script directly, same pattern
as `generate:perks` / `generate:addons` / `generate:items` above:

```bash
npm run generate:build-sheet src/data/balancing/1v4-quartet/lich/lich-killer-build.yaml -- --out public/images/builds/1v4-quartet/lich
```

Or, to skip figuring out `--out` (and `--rules`) by hand, use
`scripts/generate-build-sheet.sh` — it resolves the format/killer and the matching
`<killer>-build.yaml` allow-list straight from the input file's own path:

```bash
scripts/generate-build-sheet.sh src/data/balancing/1v4-quartet/ghoul/ghoul-survivors-build.yaml
```

## Authoring the YAML

This README covers **running** the generator. The YAML schema — `allow`/`deny`
precedence, selectors (rarity/tier groups, colon-name quoting), name resolution, and the
image-only limit families (combination bans, duplicate/repetition limits, pick limits) —
is documented in the tool's repo:

- [perks (perk allow-lists)](https://github.com/shenapse/dbd-balancing-sheet-generator/blob/main/docs/perks.md)
- [addons (add-on allow-lists)](https://github.com/shenapse/dbd-balancing-sheet-generator/blob/main/docs/addons.md)
- [items (item allow-lists)](https://github.com/shenapse/dbd-balancing-sheet-generator/blob/main/docs/items.md)
- [builds (concrete build sheets)](https://github.com/shenapse/dbd-balancing-sheet-generator/blob/main/docs/builds.md)

The `{ exhaustion: true }` and `{ tag: ... }` perk selectors are not supported by this
tool and fail with an error.
