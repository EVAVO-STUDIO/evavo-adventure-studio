export type NightShiftFoundationIconId = "walk" | "look" | "use" | "talk";

export interface NightShiftFoundationIconMaster {
  readonly id: NightShiftFoundationIconId;
  readonly assetId: string;
  readonly width: 16;
  readonly height: 16;
  readonly transparentIndex: 0;
  readonly paletteOffset: 0;
  readonly indices: Uint8Array;
  readonly rules: readonly string[];
}

const patternToIndices = (rows: readonly string[]): Uint8Array => {
  if (rows.length !== 16 || rows.some((row) => row.length !== 16)) {
    throw new RangeError("Night Shift icon patterns must be exactly 16×16 native pixels.");
  }
  const bytes = new Uint8Array(16 * 16);
  rows.forEach((row, y) => {
    [...row].forEach((character, x) => {
      const value = character === "." ? 0 : Number.parseInt(character, 10);
      if (!Number.isInteger(value) || value < 0 || value > 3) {
        throw new RangeError(`Night Shift icon pattern uses unsupported pixel token '${character}'.`);
      }
      bytes[y * 16 + x] = value;
    });
  });
  return bytes;
};

const icon = (
  id: NightShiftFoundationIconId,
  rows: readonly string[],
  rules: readonly string[],
): NightShiftFoundationIconMaster => ({
  id,
  assetId: `asset.night-shift.ui.${id}`,
  width: 16,
  height: 16,
  transparentIndex: 0,
  paletteOffset: 0,
  indices: patternToIndices(rows),
  rules,
});

export const nightShiftFoundationIcons: readonly NightShiftFoundationIconMaster[] = [
  icon(
    "walk",
    [
      "................",
      "......22........",
      ".....2332.......",
      ".....2332.......",
      ".....2332.......",
      ".....233........",
      ".....233........",
      ".....233........",
      "....2233........",
      "...23333........",
      "..2333332.......",
      ".233333332......",
      ".2333333332.....",
      "..222222222.....",
      "................",
      "................",
    ],
    [
      "Read as a practical shoe/step silhouette, not a modern navigation arrow.",
      "Keep the sole flat and chunky enough to survive raw 1× viewing.",
    ],
  ),
  icon(
    "look",
    [
      "................",
      "................",
      ".....22222......",
      "...223333322....",
      "..23333333332...",
      ".2333322333332..",
      ".2333211233332..",
      ".2333211233332..",
      ".2333322333332..",
      "..23333333332...",
      "...223333322....",
      ".....22222......",
      "................",
      "................",
      "................",
      "................",
    ],
    [
      "Use an eye silhouette rather than a magnifying glass to preserve early icon-bar grammar.",
      "Keep the pupil small and high-contrast without anti-aliased circular edges.",
    ],
  ),
  icon(
    "use",
    [
      "................",
      ".......22.......",
      "......2332......",
      "....2.2332......",
      "...2322332......",
      "..23323332......",
      "..233333332.....",
      "..2333333332....",
      "...233333332....",
      "...233333332....",
      "....2333332.....",
      "....2333332.....",
      ".....23332......",
      "......222.......",
      "................",
      "................",
    ],
    [
      "Read as a hand/reach silhouette rather than a tool or gear icon.",
      "Favor one clear gesture over anatomically noisy individual fingers.",
    ],
  ),
  icon(
    "talk",
    [
      "................",
      ".....222222.....",
      "...2233333322...",
      "..233333333332..",
      ".23333333333332.",
      ".23333333333332.",
      ".23332222333332.",
      ".23333333333332.",
      "..233333333332..",
      "...2333333332...",
      "....23333332....",
      ".....233332.....",
      ".....23332......",
      "......222.......",
      "................",
      "................",
    ],
    [
      "Use a compact speech balloon with a short tail, not a modern chat-app glyph.",
      "Keep the interior nearly solid so the shape reads at 1× without outline dependency.",
    ],
  ),
] as const;

export const nightShiftFoundationIconById = (
  id: NightShiftFoundationIconId,
): NightShiftFoundationIconMaster => {
  const result = nightShiftFoundationIcons.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Unknown Night Shift foundation icon '${id}'.`);
  return result;
};

export const validateNightShiftFoundationIcons = (): readonly string[] => {
  const issues: string[] = [];
  const assetIds = new Set<string>();
  for (const master of nightShiftFoundationIcons) {
    if (assetIds.has(master.assetId)) issues.push(`Duplicate icon asset '${master.assetId}'.`);
    assetIds.add(master.assetId);
    if (master.indices.length !== 256) issues.push(`${master.id} does not contain 256 native pixels.`);
    let visible = 0;
    let maximum = 0;
    for (const value of master.indices) {
      if (value !== master.transparentIndex) visible += 1;
      maximum = Math.max(maximum, value);
    }
    if (visible < 24) issues.push(`${master.id} is too sparse to read reliably at 1×.`);
    if (maximum > 3) issues.push(`${master.id} exceeds the reserved three-tone UI icon ramp.`);
  }
  return issues;
};
