import { describe, expect, it } from "vitest";
import {
  CliUsageError,
  parseCliArguments,
} from "../src/arguments.js";

describe("cli arguments", () => {
  it("parses complete compile commands", () => {
    expect(
      parseCliArguments([
        "compile",
        "--project",
        "game/project.json",
        "--asset-manifest",
        "build/assets.json",
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
      format: "human",
    });
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
