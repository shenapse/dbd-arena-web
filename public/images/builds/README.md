# Build Sheets

This REAME explains how to generate **build-restriction sheets** shown on the site — the
killer/survivor perk sheets, killer add-on sheets, and survivor item sheets.

## Prerequisites

- `npm install` at the repo root — the three generator CLIs (`dbd-perk-sheet`,
  `dbd-addon-sheet`, `dbd-item-sheet`) are pulled in as `optionalDependencies` from `balancing-tool` repo.
- see `package.json` for info about `balancing-tool` repo

## Generating sheets

The `generate:*` scripts (see `package.json`) wrap each CLI with the default asset root.
They do **not** auto-discover files — pass the target YAML path(s) after `--`. Run from
the repo root:

```bash
# regenerate every sheet for one killer
npm run generate:perks  -- path/to/per-killer-balancing.yaml
npm run generate:addons -- path/to/per-killer-balancing.yaml
npm run generate:items  -- path/to/per-killer-balancing.yaml
```

- **Output goes next to the input YAML** by default (into that killer's folder).
  Append `-- --out <dir>` to write elsewhere.
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