// Shared fs read + YAML parse for a `<killer>-conditions.yaml` file, factored
// out of MatchConditions.astro so both it and BalancingOverview.astro (which
// needs to read *many* killers' conditions files while rendering one format's
// overview table) share a single implementation.
//
// The file path is built as
// `src/data/balancing/<format>/<killer>/<killer>-conditions.yaml`, resolved
// under the project root via process.cwd() (the project root under both
// `astro dev` and `astro build`) — e.g. format="1v4-quartet" killer="blight"
// -> src/data/balancing/1v4-quartet/blight/blight-conditions.yaml.
//
// Note: unlike import.meta.glob, an fs read is not in Vite's watched module
// graph, so editing a YAML during `astro dev` needs a dev-server restart to
// show.
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import type { MatchConditions } from './types';

function buildPath(format: string, killer: string): string {
  return path.join(process.cwd(), 'src/data/balancing', format, killer, `${killer}-conditions.yaml`);
}

/**
 * Read + parse a killer's `-conditions.yaml`. A missing/misspelled
 * format/killer, or a missing file, is a caller mistake — throws loudly
 * rather than rendering nothing (matches MatchConditions.astro's original
 * behavior).
 */
export function loadMatchConditions(format: string, killer: string): MatchConditions {
  if (!format || !killer) throw new Error(`loadMatchConditions: "format" and "killer" are required.`);
  const filePath = buildPath(format, killer);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `loadMatchConditions: YAML not found at "${filePath}" (format: "${format}", killer: "${killer}").`
    );
  }
  return parse(fs.readFileSync(filePath, 'utf8')) as MatchConditions;
}

/**
 * Same as `loadMatchConditions`, but returns `null` instead of throwing when
 * the conditions file doesn't exist. Used by BalancingOverview so a manifest
 * row pointing at a not-yet-authored conditions file degrades to blank
 * cells rather than breaking the page build. `format`/`killer` are still
 * required to be non-empty (a caller mistake there still throws).
 */
export function tryLoadMatchConditions(format: string, killer: string): MatchConditions | null {
  if (!format || !killer) throw new Error(`tryLoadMatchConditions: "format" and "killer" are required.`);
  const filePath = buildPath(format, killer);
  if (!fs.existsSync(filePath)) return null;
  return parse(fs.readFileSync(filePath, 'utf8')) as MatchConditions;
}
