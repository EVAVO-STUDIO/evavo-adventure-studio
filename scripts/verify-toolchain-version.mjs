import { readFile } from "node:fs/promises";

const readText = async (path) => (await readFile(path, "utf8")).trim();
const parseVersion = (value, label) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) throw new Error(`${label} '${value}' is not an exact semantic version.`);
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
  throw new Error(
    `.node-version (${nodeVersion}) and .nvmrc (${nvmVersion}) must match.`,
  );
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const expectedEngine = `>=${nodeVersion} <25`;
if (packageJson.engines?.node !== expectedEngine) {
  throw new Error(
    `package.json engines.node must be '${expectedEngine}', received '${String(packageJson.engines?.node)}'.`,
  );
}

const minimum = parseVersion(nodeVersion, ".node-version");
const actual = parseVersion(process.versions.node, "Active Node.js");
if (actual[0] !== 24 || compareVersion(actual, minimum) < 0) {
  throw new Error(
    `Node.js ${process.versions.node} is unsupported; expected ${expectedEngine}.`,
  );
}

process.stdout.write(
  `Toolchain verified: Node.js ${process.versions.node}, minimum ${nodeVersion}.\n`,
);
