#!/usr/bin/env node

import { runCli } from "./runner.js";
import { runRuntimeArtifactCli } from "./runtime-artifacts.js";

const argv = process.argv.slice(2);
const runtimeArtifactExitCode = await runRuntimeArtifactCli(argv);
process.exitCode =
  runtimeArtifactExitCode === null ? await runCli(argv) : runtimeArtifactExitCode;
