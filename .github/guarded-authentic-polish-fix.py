from __future__ import annotations

from pathlib import Path
from runpy import run_path


base = run_path(".github/guarded-authentic-polish-fix-base.py")
base_main = base.get("main")
if not callable(base_main):
    raise SystemExit("The guarded authentic-polish base repair has no callable main().")
base_main()

compatibility_path = Path("packages/save-game/src/compatibility.ts")
source = compatibility_path.read_text(encoding="utf-8")
old = '''    if (
      authored.instance.actorId !== actorState.actorId ||
      authored.sceneId !== actorState.sceneId
    ) {
      addSaveGameIssue(
        issues,
        "actor-instance-identity-mismatch",
        `world.actorInstances.${key}`,
        `Saved actor instance '${key}' no longer matches its authored actor ` +
          "or scene.",
      );
    }
'''
new = '''    if (authored.instance.actorId !== actorState.actorId) {
      addSaveGameIssue(
        issues,
        "actor-instance-identity-mismatch",
        `world.actorInstances.${key}.actorId`,
        `Saved actor instance '${key}' no longer matches its authored actor.`,
      );
    }
    if (
      !bundle.scenes.some((candidate) => candidate.id === actorState.sceneId)
    ) {
      addSaveGameIssue(
        issues,
        "actor-instance-identity-mismatch",
        `world.actorInstances.${key}.sceneId`,
        `Saved actor instance '${key}' references missing scene ` +
          `'${actorState.sceneId}'.`,
      );
    }
'''
if source.count(old) != 1:
    raise SystemExit(
        "packages/save-game/src/compatibility.ts: expected one authored-scene identity block."
    )
compatibility_path.write_text(
    source.replace(old, new),
    encoding="utf-8",
    newline="\n",
)

for list_name in (
    "/tmp/authentic-polish-paths.txt",
    "/tmp/authentic-polish-text-paths.txt",
    "/tmp/authentic-polish-biome-paths.txt",
):
    path = Path(list_name)
    values = set(path.read_text(encoding="utf-8").splitlines())
    values.add("packages/save-game/src/compatibility.ts")
    path.write_text(
        "\n".join(sorted(value for value in values if value)) + "\n",
        encoding="utf-8",
        newline="\n",
    )

Path(".github/guarded-authentic-polish-fix-base.py").unlink()
print("Applied persistent multi-room actor save compatibility repair.")
