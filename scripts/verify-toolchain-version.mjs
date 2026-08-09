import { readFile } from "node:fs/promises";

const readText = async (path) => (await readFile(path, "utf8")).trim();

const parseVersion = (value, label) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new Error(`${label} '${value}' is not an exact semantic version.`);
  }
  return match.slice(1).map(Number);
};

const compareVersion = (left, right) => {
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};

const nodeVersion = await readText(".node-version");
const nvmVersion = await readText(".nvmrc");
if (nodeVersion !== nvmVersion) {
  throw new Error(`.node-version (${nodeVersion}) and .nvmrc (${nvmVersion}) must match.`);
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const expectedNodeEngine = `>=${nodeVersion} <25`;
if (packageJson.engines?.node !== expectedNodeEngine) {
  throw new Error(
    `package.json engines.node must be '${expectedNodeEngine}', received '${String(packageJson.engines?.node)}'.`,
  );
}

const packageManager = String(packageJson.packageManager ?? "");
const packageManagerMatch = /^pnpm@(\d+\.\d+\.\d+)$/.exec(packageManager);
if (!packageManagerMatch?.[1]) {
  throw new Error(
    `package.json packageManager must pin an exact pnpm version, received '${packageManager}'.`,
  );
}
const pnpmVersion = packageManagerMatch[1];
const expectedPnpmEngine = `>=${pnpmVersion} <12`;
if (packageJson.engines?.pnpm !== expectedPnpmEngine) {
  throw new Error(
    `package.json engines.pnpm must be '${expectedPnpmEngine}', received '${String(packageJson.engines?.pnpm)}'.`,
  );
}

const minimumNode = parseVersion(nodeVersion, ".node-version");
const actualNode = parseVersion(process.versions.node, "Active Node.js");
if (actualNode[0] !== 24 || compareVersion(actualNode, minimumNode) < 0) {
  throw new Error(`Node.js ${process.versions.node} is unsupported; expected ${expectedNodeEngine}.`);
}

const userAgent = process.env.npm_config_user_agent ?? "";
const activePnpmMatch = /(?:^|\s)pnpm\/(\d+\.\d+\.\d+)(?:\s|$)/.exec(userAgent);
if (!activePnpmMatch?.[1]) {
  throw new Error("The toolchain check must run through pnpm so the active pnpm version can be verified.");
}
const actualPnpmVersion = activePnpmMatch[1];
const minimumPnpm = parseVersion(pnpmVersion, "packageManager pnpm");
const actualPnpm = parseVersion(actualPnpmVersion, "Active pnpm");
if (actualPnpm[0] !== 11 || compareVersion(actualPnpm, minimumPnpm) < 0) {
  throw new Error(`pnpm ${actualPnpmVersion} is unsupported; expected ${expectedPnpmEngine}.`);
}

process.stdout.write(`Toolchain verified: Node.js ${process.versions.node} and pnpm ${actualPnpmVersion}.\n`);
