import { describe, expect, it } from "vitest";
import { CliUsageError, parseCliArguments } from "../src/arguments.js";

describe("cli arguments", () => {
  it("parses complete compile commands with scene staging, indexed palette data and production evidence", () => {
    expect(
      parseCliArguments([
        "compile",
        "--project",
        "game/project.json",
        "--asset-manifest",
        "build/assets.json",
        "--scene-instances",
        "game/scene-instances.json",
        "--scene-staging",
        "game/scene-staging.json",
        "--indexed-assets",
        "build/indexed-assets.json",
        "--palette-maps",
        "game/palette-maps.json",
        "--art-direction",
        "game/art-direction.json",
        "--art-evidence",
        "build/art-evidence.json",
        "--bitmap-fonts",
        "game/bitmap-fonts.json",
        "--ui-skins",
        "game/ui-skins.json",
        "--audio-mix",
        "game/audio-mix.json",
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
      sceneStagingPath: "game/scene-staging.json",
      indexedAssetsPath: "build/indexed-assets.json",
      paletteMapsPath: "game/palette-maps.json",
      artDirectionPath: "game/art-direction.json",
      artEvidencePath: "build/art-evidence.json",
      bitmapFontsPath: "game/bitmap-fonts.json",
      uiSkinsPath: "game/ui-skins.json",
      audioMixPath: "game/audio-mix.json",
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
      sceneStagingPath: null,
      indexedAssetsPath: null,
      paletteMapsPath: null,
      artDirectionPath: null,
      artEvidencePath: null,
      bitmapFontsPath: null,
      uiSkinsPath: null,
      audioMixPath: null,
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
      sceneStagingPath: null,
      indexedAssetsPath: null,
      paletteMapsPath: null,
      artDirectionPath: null,
      artEvidencePath: null,
      bitmapFontsPath: null,
      uiSkinsPath: null,
      audioMixPath: null,
      format: "human",
    });
  });

  it("allows focused staging, font, interface and audio validation without compiled assets", () => {
    expect(
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--scene-staging",
        "scene-staging.json",
        "--bitmap-fonts",
        "bitmap-fonts.json",
        "--ui-skins",
        "ui-skins.json",
        "--audio-mix",
        "audio-mix.json",
      ]),
    ).toMatchObject({
      kind: "validate",
      sceneStagingPath: "scene-staging.json",
      indexedAssetsPath: null,
      paletteMapsPath: null,
      bitmapFontsPath: "bitmap-fonts.json",
      uiSkinsPath: "ui-skins.json",
      audioMixPath: "audio-mix.json",
      assetManifestPath: null,
    });
  });

  it("allows indexed assets and palette maps when compiled asset identity is available", () => {
    expect(
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--asset-manifest",
        "assets.json",
        "--indexed-assets",
        "indexed-assets.json",
        "--palette-maps",
        "palette-maps.json",
      ]),
    ).toMatchObject({
      kind: "validate",
      assetManifestPath: "assets.json",
      indexedAssetsPath: "indexed-assets.json",
      paletteMapsPath: "palette-maps.json",
    });
  });

  it("requires an asset manifest for indexed assets and palette maps", () => {
    expect(() =>
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--indexed-assets",
        "indexed-assets.json",
      ]),
    ).toThrow(/--indexed-assets.*--asset-manifest/u);

    expect(() =>
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--palette-maps",
        "palette-maps.json",
      ]),
    ).toThrow(/--palette-maps.*--asset-manifest/u);
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
      parseCliArguments([
        "art-evidence",
        "--project",
        "project.json",
        "--asset-manifest",
        "assets.json",
        "--scene-staging",
        "scene-staging.json",
        "--out",
        "evidence.json",
      ]),
    ).toThrow(CliUsageError);
    expect(() =>
      parseCliArguments([
        "validate",
        "--project",
        "project.json",
        "--wat",
      ]),
    ).toThrow(CliUsageError);
  });
});
