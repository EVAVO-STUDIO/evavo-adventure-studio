import { describe, expect, it } from "vitest";
import {
  CliUsageError,
  parseCliArguments,
} from "../src/arguments.js";

describe("cli arguments", () => {
  it("parses complete compile commands with art evidence", () => {
    expect(
      parseCliArguments([
        "compile",
        "--project",
        "game/project.json",
        "--asset-manifest",
        "build/assets.json",
        "--scene-instances",
        "game/scene-instances.json",
        "--art-direction",
        "game/art-direction.json",
        "--art-evidence",
        "build/art-evidence.json",
        "--out",
        "build/game.bundle.json",
        "--report",
        "build/report.json",
        "--json",
      ]),
    ).toEqual({
      kind: "compile",
      projectPath: "game/project.json",
      assetManifestPath: "build/assets.json",
      sceneInstancesPath: "game/scene-instances.json",
      artDirectionPath: "game/art-direction.json",
      artEvidencePath: "build/art-evidence.json",
      outputPath: "build/game.bundle.json",
      reportPath: "build/report.json",
      format: "json",
    });
  });

  it("parses clean release package commands", () => {
    expect(
      parseCliArguments([
        "package",
        "--project",
        "game/project.json",
        "--asset-manifest",
        "build/assets.json",
        "--output",
        "release/windows",
        "--json",
      ]),
    ).toEqual({
      kind: "package",
      projectPath: "game/project.json",
      assetManifestPath: "build/assets.json",
      sceneInstancesPath: null,
      artDirectionPath: null,
      artEvidencePath: null,
      outputDirectory: "release/windows",
      format: "json",
    });
  });

  it("allows project-only validation", () => {
    expect(
      parseCliArguments(["validate", "--project", "project.json"]),
    ).toEqual({
      kind: "validate",
      projectPath: "project.json",
      assetManifestPath: null,
      sceneInstancesPath: null,
      artDirectionPath: null,
      artEvidencePath: null,
      format: "human",
    });
  });

  it("allows policy validation before compiled evidence exists", () => {
    expect(
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--art-direction",
        "art-direction.json",
      ]),
    ).toMatchObject({
      kind: "validate",
      artDirectionPath: "art-direction.json",
      artEvidencePath: null,
    });
  });

  it("requires policy and asset manifests for visual evidence", () => {
    expect(() =>
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--art-evidence",
        "art-evidence.json",
      ]),
    ).toThrowError(CliUsageError);

    expect(() =>
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--art-direction",
        "art-direction.json",
        "--art-evidence",
        "art-evidence.json",
      ]),
    ).toThrowError(CliUsageError);
  });

  it("rejects missing values, duplicate aliases and command-specific options", () => {
    expect(() => parseCliArguments(["compile", "--project"])).toThrow(
      CliUsageError,
    );
    expect(() =>
      parseCliArguments([
        "compile",
        "--project",
        "project.json",
        "--asset-manifest",
        "assets.json",
        "--out",
        "one.json",
        "--output",
        "two.json",
      ]),
    ).toThrow(CliUsageError);
    expect(() =>
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--out",
        "invalid.json",
      ]),
    ).toThrow(CliUsageError);
    expect(() =>
      parseCliArguments(["validate", "--project", "project.json", "--wat"]),
    ).toThrow(CliUsageError);
  });
});
