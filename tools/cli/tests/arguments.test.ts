import { describe, expect, it } from "vitest";
import {
  CliUsageError,
  parseCliArguments,
} from "../src/arguments.js";

describe("cli arguments", () => {
  it("parses complete compile commands with visual font and UI evidence", () => {
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
        "--bitmap-fonts",
        "game/bitmap-fonts.json",
        "--ui-skins",
        "game/ui-skins.json",
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
      bitmapFontsPath: "game/bitmap-fonts.json",
      uiSkinsPath: "game/ui-skins.json",
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
      bitmapFontsPath: null,
      uiSkinsPath: null,
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
      bitmapFontsPath: null,
      uiSkinsPath: null,
      format: "human",
    });
  });

  it("allows focused font and interface validation without compiled assets", () => {
    expect(
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--bitmap-fonts",
        "bitmap-fonts.json",
        "--ui-skins",
        "ui-skins.json",
      ]),
    ).toMatchObject({
      kind: "validate",
      bitmapFontsPath: "bitmap-fonts.json",
      uiSkinsPath: "ui-skins.json",
      assetManifestPath: null,
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
