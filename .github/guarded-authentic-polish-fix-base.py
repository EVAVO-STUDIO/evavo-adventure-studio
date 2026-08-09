from __future__ import annotations

from pathlib import Path


def replace_exact(path_value: str, old: str, new: str) -> None:
    path = Path(path_value)
    source = path.read_text(encoding="utf-8")
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one guarded source block, found {count}.")
    path.write_text(source.replace(old, new), encoding="utf-8", newline="\n")


def insert_status_default() -> None:
    path = Path("packages/runtime-controller/src/packaged-controller.ts")
    source = path.read_text(encoding="utf-8")
    marker = "const statusFromCommandEvent = (event: SceneCommandEvent): string => {"
    start = source.find(marker)
    if start < 0:
        raise SystemExit(f"{path}: statusFromCommandEvent declaration is missing.")
    end_marker = "\n};"
    end = source.find(end_marker, start)
    if end < 0:
        raise SystemExit(f"{path}: statusFromCommandEvent terminator is missing.")
    end += len(end_marker)
    block = source[start:end]
    if "default:" not in block:
        closing_switch = block.rfind("\n  }")
        if closing_switch < 0:
            raise SystemExit(f"{path}: statusFromCommandEvent switch terminator is missing.")
        block = (
            block[:closing_switch]
            + '\n    default:\n      return "ACTION COULD NOT BE RESOLVED";'
            + block[closing_switch:]
        )
        source = source[:start] + block + source[end:]
        path.write_text(source, encoding="utf-8", newline="\n")


def repair_renderer_method() -> None:
    replace_exact(
        "packages/renderer-pixi/src/texture-store.ts",
        '''  hasTexture(
    assetId: Id<"asset">,
    frameId: Id<"sprite-frame"> | null = null,
  ): boolean => this.getTexture(assetId, frameId) !== null;
''',
        '''  hasTexture(
    assetId: Id<"asset">,
    frameId: Id<"sprite-frame"> | null = null,
  ): boolean {
    return this.getTexture(assetId, frameId) !== null;
  }
''',
    )


def repair_red_ledger_manifest_access() -> None:
    replace_exact(
        "packages/adventure-design/src/red-ledger-runtime.ts",
        '''  return requireProjectIdentity({
    project: parseAdventureProject(source.project),
    assetManifest: parseAssetBuildManifest(source.assetManifest),
    bitmapFonts: parseBitmapFontManifest(source.bitmapFonts),
    uiSkins: parseUiSkinManifest(source.uiSkins),
    sceneInstances: parseSceneInstanceManifest(source.sceneInstances),
  });
''',
        '''  return requireProjectIdentity({
    project: parseAdventureProject(source["project"]),
    assetManifest: parseAssetBuildManifest(source["assetManifest"]),
    bitmapFonts: parseBitmapFontManifest(source["bitmapFonts"]),
    uiSkins: parseUiSkinManifest(source["uiSkins"]),
    sceneInstances: parseSceneInstanceManifest(source["sceneInstances"]),
  });
''',
    )


def repair_scene_transition_test_ids() -> None:
    path = Path("packages/scene-runtime/tests/scene-transition.test.ts")
    source = path.read_text(encoding="utf-8")
    import_line = 'import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";'
    if 'import type { Id } from "@evavo/adventure-project-schema";' not in source:
        if source.count(import_line) != 1:
            raise SystemExit(f"{path}: RuntimeBundle import did not match once.")
        source = source.replace(
            import_line,
            'import type { Id } from "@evavo/adventure-project-schema";\n' + import_line,
            1,
        )
    source = source.replace(
        '"actor-instance.archivist",',
        '"actor-instance.archivist" as Id<"actor-instance">,',
    )
    source = source.replace(
        '"scene.chapel",\n      "entrance.chapel.archive-door",',
        '"scene.chapel" as Id<"scene">,\n'
        '      "entrance.chapel.archive-door" as Id<"entrance">,',
    )
    source = source.replace(
        '"scene.chapel",\n        "entrance.chapel.missing",',
        '"scene.chapel" as Id<"scene">,\n'
        '        "entrance.chapel.missing" as Id<"entrance">,',
    )
    path.write_text(source, encoding="utf-8", newline="\n")


def repair_classic_experience_app() -> None:
    path = Path("apps/studio/src/ClassicExperienceApp.tsx")
    old = '''const principleLabel = (principle: ClassicExperiencePrincipleResult): string =>
  principle.id.replaceAll("-", " ");

export const ClassicExperienceApp = () => {
  const [projectIndex, setProjectIndex] = useState(1);
  const project =
    classicAdventureCreatorProjects[projectIndex] ??
    classicAdventureCreatorProjects[0]!;
'''
    new = '''const principleLabel = (principle: ClassicExperiencePrincipleResult): string =>
  principle.id.replaceAll("-", " ");

const defaultClassicAdventureProject = classicAdventureCreatorProjects[0];
if (!defaultClassicAdventureProject) {
  throw new Error("Classic Experience requires at least one creator project.");
}

export const ClassicExperienceApp = () => {
  const [projectIndex, setProjectIndex] = useState(1);
  const project =
    classicAdventureCreatorProjects[projectIndex] ??
    defaultClassicAdventureProject;
'''
    replace_exact(str(path), old, new)


def repair_classic_experience_tests() -> None:
    path = Path("packages/adventure-design/tests/classic-experience.test.ts")
    source = path.read_text(encoding="utf-8")
    helper_old = '''const mutable = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorProject => structuredClone(project);

'''
    helper_new = '''const mutable = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorProject => structuredClone(project);

const mutableProjectAt = (index: number): ClassicAdventureCreatorProject => {
  const project = classicAdventureCreatorProjects[index];
  if (!project) {
    throw new Error(`Classic experience fixture ${index} is missing.`);
  }
  return mutable(project);
};

const firstPuzzle = (
  project: ClassicAdventureCreatorProject,
): ClassicAdventureCreatorProject["puzzles"][number] => {
  const puzzle = project.puzzles[0];
  if (!puzzle) {
    throw new Error(`Classic experience project '${project.id}' has no puzzle.`);
  }
  return puzzle;
};

'''
    if helper_old in source:
        source = source.replace(helper_old, helper_new, 1)
    source = source.replace(
        "const project = mutable(classicAdventureCreatorProjects[0]!);\n"
        "    const puzzle = project.puzzles[0]!;",
        "const project = mutableProjectAt(0);\n"
        "    const puzzle = firstPuzzle(project);",
    )
    source = source.replace(
        "const project = mutable(classicAdventureCreatorProjects[1]!);\n"
        "    const puzzle = project.puzzles[0]!;",
        "const project = mutableProjectAt(1);\n"
        "    const puzzle = firstPuzzle(project);",
    )
    if "classicAdventureCreatorProjects[0]!" in source or "project.puzzles[0]!" in source:
        raise SystemExit(f"{path}: non-null assertions remain after guarded repair.")
    path.write_text(source, encoding="utf-8", newline="\n")


def update_scope_lists() -> None:
    additions = {"packages/renderer-pixi/src/texture-store.ts"}
    for list_name in (
        "/tmp/authentic-polish-paths.txt",
        "/tmp/authentic-polish-text-paths.txt",
        "/tmp/authentic-polish-biome-paths.txt",
    ):
        path = Path(list_name)
        values = set(path.read_text(encoding="utf-8").splitlines())
        values.update(additions)
        path.write_text(
            "\n".join(sorted(value for value in values if value)) + "\n",
            encoding="utf-8",
            newline="\n",
        )


def main() -> None:
    repair_renderer_method()
    repair_red_ledger_manifest_access()
    repair_scene_transition_test_ids()

    main_path = Path("apps/player/src/main.ts")
    main_source = main_path.read_text(encoding="utf-8")
    if main_source.count("host.dataset.mode") != 3:
        raise SystemExit("apps/player/src/main.ts: expected three dataset.mode writes.")
    main_source = main_source.replace("host.dataset.mode", 'host.dataset["mode"]')
    main_source = main_source.replace(
        'import type { ReplayEvent, ReplayLog } from "@evavo/adventure-replay";',
        'import type { ReplayLog } from "@evavo/adventure-replay";',
        1,
    )
    main_path.write_text(main_source, encoding="utf-8", newline="\n")

    replace_exact(
        "packages/scene-runtime/src/scene-transition.ts",
        "      `Actor '${actor.id}' has no idle or '${actorInstance.animationState}' ` +\n"
        "        \"arrival animation.\",",
        "      `Actor '${actor.id}' has no idle or "
        "'${actorInstance.animationState}' arrival animation.`,",
    )
    replace_exact(
        "packages/runtime-controller/src/packaged-controller.ts",
        "  const submitParserCommand = (input: string): void => {\n"
        '    if (!runtimeSkin || runtimeSkin.interactionMode !== "parser-assisted") {',
        "  const submitParserCommand = (input: string): void => {\n"
        '    if (runtimeSkin?.interactionMode !== "parser-assisted") {',
    )
    replace_exact(
        "packages/runtime-controller/src/packaged-controller.ts",
        "  const handleKey = (input: ParserKeyInput): boolean => {\n"
        '    if (!runtimeSkin || runtimeSkin.interactionMode !== "parser-assisted") {',
        "  const handleKey = (input: ParserKeyInput): boolean => {\n"
        '    if (runtimeSkin?.interactionMode !== "parser-assisted") {',
    )
    insert_status_default()
    replace_exact(
        "packages/scene-runtime/src/index.ts",
        "  const asset = assetsById(bundle).get(scene.backgroundAssetId);\n"
        '  if (!asset || asset.kind !== "image") {',
        "  const asset = assetsById(bundle).get(scene.backgroundAssetId);\n"
        '  if (asset?.kind !== "image") {',
    )
    replace_exact(
        "scripts/validate-red-ledger-runtime.mjs",
        "    const key = JSON.stringify([interaction.verb, interaction.itemId ?? null]);\n"
        "    (interactionIndex[key] ??= []).push(interaction.id);",
        "    const key = JSON.stringify([interaction.verb, interaction.itemId ?? null]);\n"
        "    const interactionIds = interactionIndex[key] ?? [];\n"
        "    interactionIds.push(interaction.id);\n"
        "    interactionIndex[key] = interactionIds;",
    )
    repair_classic_experience_app()
    repair_classic_experience_tests()
    update_scope_lists()
    print("Applied reviewed authentic-polish repairs.")


if __name__ == "__main__":
    main()
