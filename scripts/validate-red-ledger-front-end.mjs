import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const demoDirectory = join(repository, "apps/player/public/demos/the-red-ledger");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const source = readJson(join(demoDirectory, "source-manifests.json"));
const bundle = readJson(join(demoDirectory, "runtime.bundle.json"));
const frontEnd = readJson(join(demoDirectory, "front-end.json"));
const builtInDemosSource = readFileSync(join(repository, "apps/player/src/built-in-demos.ts"), "utf8");
const runtimeLoaderSource = readFileSync(join(repository, "apps/player/src/runtime-loader.ts"), "utf8");
const classicFrontEndSource = readFileSync(
  join(repository, "apps/player/src/classic-front-end.ts"),
  "utf8",
);
const builtInDemoTestSource = readFileSync(
  join(repository, "apps/player/tests/built-in-demos.test.ts"),
  "utf8",
);
const runtimeLoaderTestSource = readFileSync(
  join(repository, "apps/player/tests/runtime-loader.test.ts"),
  "utf8",
);
const redLedgerFrontEndTestSource = readFileSync(
  join(repository, "apps/player/tests/red-ledger-front-end.test.ts"),
  "utf8",
);
const frontEndCompilerSource = readFileSync(
  join(repository, "packages/compiler/src/with-front-end.ts"),
  "utf8",
);
const errors = [];

const requireValue = (condition, message) => {
  if (!condition) errors.push(message);
};
const record = (value) => value && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, expected) =>
  record(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const boundedText = (value, maximum) =>
  typeof value === "string" && value.length > 0 && value.length <= maximum;

const projectId = "project.red-ledger.playable-slice";
requireValue(frontEnd?.manifestVersion === 1, "Front-end manifestVersion must equal 1.");
requireValue(frontEnd?.projectId === projectId, "Front-end manifest has the wrong project ID.");
requireValue(source?.project?.id === projectId, "Red Ledger source project ID has drifted.");
requireValue(bundle?.projectId === projectId, "Red Ledger runtime project ID has drifted.");
requireValue(
  bundle.frontEnd === undefined,
  "The checked-in bundle must not also define frontEnd while the built-in sidecar is active.",
);
requireValue(
  bundle.localisation === undefined,
  "A localised Red Ledger bundle must embed frontEnd through " +
    "compileProjectWithFrontEnd instead of a sidecar.",
);
requireValue(
  exactKeys(frontEnd, ["manifestVersion", "projectId", "publisher", "title", "menu", "options", "credits"]),
  "The Red Ledger front-end manifest has missing or unexpected fields.",
);

const publisher = frontEnd?.publisher;
requireValue(
  exactKeys(publisher, ["name", "presents", "splashDurationTicks", "splashSkipAfterTicks"]),
  "Front-end publisher settings have missing or unexpected fields.",
);
requireValue(publisher?.name === "EVAVO", "The front-end publisher must remain EVAVO.");
requireValue(
  publisher?.presents === "ADVENTURE STUDIO PRESENTS",
  "The front-end publisher line has drifted.",
);
requireValue(
  Number.isInteger(publisher?.splashDurationTicks) &&
    publisher.splashDurationTicks >= 1 &&
    publisher.splashDurationTicks <= 600,
  "The front-end splash duration is invalid.",
);
requireValue(
  Number.isInteger(publisher?.splashSkipAfterTicks) &&
    publisher.splashSkipAfterTicks >= 0 &&
    publisher.splashSkipAfterTicks <= publisher.splashDurationTicks,
  "The front-end splash skip timing is invalid.",
);

requireValue(exactKeys(frontEnd?.title, ["kicker"]), "Front-end title settings are invalid.");
requireValue(
  frontEnd?.title?.kicker === "A RAIN-SOAKED ARCHIVE MYSTERY",
  "The Red Ledger title kicker has drifted.",
);

const menu = frontEnd?.menu;
requireValue(
  exactKeys(menu, ["labels", "showContinue", "showLoad", "showOptions", "showCredits", "showQuit"]),
  "Front-end menu settings have missing or unexpected fields.",
);
const expectedLabels = {
  newGame: "OPEN THE CASE",
  continueGame: "CONTINUE INVESTIGATION",
  loadGame: "CASE FILES",
  options: "OPTIONS",
  credits: "CREDITS",
  quit: "QUIT",
  quickSave: "QUICK SAVE",
  back: "BACK",
  fullscreen: "TOGGLE FULLSCREEN",
};
requireValue(
  exactKeys(menu?.labels, Object.keys(expectedLabels)),
  "Front-end menu labels have missing or unexpected fields.",
);
for (const [label, expected] of Object.entries(expectedLabels)) {
  const value = menu?.labels?.[label];
  requireValue(value === expected, `Front-end menu label '${label}' has drifted.`);
  requireValue(boundedText(value, 48), `Front-end menu label '${label}' is invalid.`);
}
for (const flag of ["showContinue", "showLoad", "showOptions", "showCredits", "showQuit"]) {
  requireValue(menu?.[flag] === true, `Front-end menu flag '${flag}' must remain enabled.`);
}

requireValue(
  exactKeys(frontEnd?.options, ["allowFullscreen"]) && frontEnd.options.allowFullscreen === true,
  "The Red Ledger front end must retain fullscreen support.",
);
requireValue(exactKeys(frontEnd?.credits, ["lines"]), "Front-end credits settings are invalid.");
requireValue(
  Array.isArray(frontEnd?.credits?.lines) &&
    frontEnd.credits.lines.length === 2 &&
    frontEnd.credits.lines.every((line) => boundedText(line, 96)),
  "The Red Ledger credits must contain two valid original credit lines.",
);
requireValue(
  frontEnd?.credits?.lines?.[0] === "AN ORIGINAL EVAVO ADVENTURE" &&
    frontEnd?.credits?.lines?.[1] === "BUILT WITH EVAVO ADVENTURE STUDIO",
  "The Red Ledger credit identity has drifted.",
);

for (const [label, sourceText, tokens] of [
  [
    "built-in demo registry",
    builtInDemosSource,
    [
      'frontEndPath: "front-end.json"',
      'hash.set("frontEnd", descriptor.frontEndPath)',
      'lifecyclePath: "lifecycle.json"',
    ],
  ],
  [
    "runtime loader",
    runtimeLoaderSource,
    [
      'hash.get("frontEnd")',
      'type RuntimeBundleSidecarKey = "frontEnd" | "lifecycle"',
      'compiledInput = attachRuntimeSidecar(',
      '"frontEnd",',
      "await fetchJson(request.frontEndUrl, fetchBundle)",
    ],
  ],
  [
    "classic front end",
    classicFrontEndSource,
    [
      "options.frontEnd?.publisher.name",
      "options.frontEnd?.title.kicker",
      "options.frontEnd?.credits.lines",
      "policyFromManifest(options.frontEnd)",
    ],
  ],
  [
    "built-in demo tests",
    builtInDemoTestSource,
    [
      'frontEndPath: "front-end.json"',
      "frontEnd=front-end.json&lifecycle=lifecycle.json",
    ],
  ],
  [
    "runtime loader tests",
    runtimeLoaderTestSource,
    [
      "expect(loaded.frontEnd).toEqual(frontEnd)",
      "already defines frontEnd data",
      "reports front-end sidecar HTTP failures",
    ],
  ],
  [
    "Red Ledger front-end journey tests",
    redLedgerFrontEndTestSource,
    [
      "parseClassicFrontEndManifest",
      '"CONTINUE INVESTIGATION"',
      '"CASE FILES"',
      'request: { kind: "load", slot: 0 }',
      'expect(loadMenu.screen).toBe("load-menu")',
    ],
  ],
  [
    "canonical front-end compiler",
    frontEndCompilerSource,
    [
      "attachRuntimeFrontEnd",
      "compileProjectWithFrontEnd",
      "extendRuntimeLocalisationPack",
      "extractFrontEndLocalisableText",
    ],
  ],
]) {
  for (const token of tokens) {
    requireValue(sourceText.includes(token), `${label} is missing '${token}'.`);
  }
}

if (errors.length > 0) {
  console.error(`Red Ledger front-end validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        projectId,
        publisher: publisher.name,
        titleKicker: frontEnd.title.kicker,
        menuLabelCount: Object.keys(expectedLabels).length,
        creditsLineCount: frontEnd.credits.lines.length,
        sidecar: "front-end.json",
        status: "valid",
      },
      null,
      2,
    ),
  );
}
