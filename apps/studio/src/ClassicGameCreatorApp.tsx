import { useEffect, useMemo, useState } from "react";
import {
  classicAdventureCreatorHistoryIsDirty,
  classicAdventureCreatorProjects,
  createClassicAdventureCreatorHistory,
  executeClassicAdventureCreatorCommand,
  markClassicAdventureCreatorSaved,
  redoClassicAdventureCreatorCommand,
  undoClassicAdventureCreatorCommand,
  validateClassicAdventureCreatorProject,
  type ClassicAdventureCreatorCommand,
  type ClassicAdventureCreatorHistory,
} from "@evavo/adventure-design/classic-game-creator";
import {
  CreatorNativePreview,
  type CreatorEntitySelection,
} from "./classic-game-creator-preview.js";
import {
  Button,
  ProjectRailButton,
  downloadProject,
  familyLabel,
  firstScene,
  projectStyle,
  sceneById,
  sceneKindLabel,
  surfaceTabs,
  type CreatorSurface,
} from "./classic-game-creator-controls.js";
import { CreatorInspector } from "./classic-game-creator-inspector.js";
import {
  InterfaceSurface,
  PuzzleSurface,
  TimingSurface,
} from "./classic-game-creator-surfaces.js";
import "./classic-game-creator.css";

export const ClassicGameCreatorApp = () => {
  const [projectIndex, setProjectIndex] = useState(0);
  const initialProject = classicAdventureCreatorProjects[0];
  if (!initialProject) throw new Error("Classic creator presets are missing.");
  const [history, setHistory] = useState<ClassicAdventureCreatorHistory>(() =>
    createClassicAdventureCreatorHistory(initialProject),
  );
  const [sceneId, setSceneId] = useState(firstScene(initialProject).id);
  const [surface, setSurface] = useState<CreatorSurface>("scene");
  const [selection, setSelection] = useState<CreatorEntitySelection | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const project = history.present;
  const scene = sceneById(project, sceneId);
  const report = useMemo(
    () => validateClassicAdventureCreatorProject(project),
    [project],
  );
  const dirty = classicAdventureCreatorHistoryIsDirty(history);

  useEffect(() => {
    if (project.scenes.some((candidate) => candidate.id === sceneId)) return;
    setSceneId(firstScene(project).id);
    setSelection(null);
  }, [project, sceneId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        setHistory((current) => undoClassicAdventureCreatorCommand(current));
      } else if (
        event.key.toLowerCase() === "y" ||
        (event.key.toLowerCase() === "z" && event.shiftKey)
      ) {
        event.preventDefault();
        setHistory((current) => redoClassicAdventureCreatorCommand(current));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const selectProject = (index: number): void => {
    const next = classicAdventureCreatorProjects[index];
    if (!next) return;
    setProjectIndex(index);
    setHistory(createClassicAdventureCreatorHistory(next));
    setSceneId(firstScene(next).id);
    setSelection(null);
    setSurface("scene");
    setNotice(null);
  };

  const execute = (command: ClassicAdventureCreatorCommand): void => {
    try {
      setHistory((current) =>
        executeClassicAdventureCreatorCommand(current, command),
      );
      setNotice(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Creator edit failed.");
    }
  };

  const selectScene = (nextSceneId: string): void => {
    setSceneId(nextSceneId);
    setSelection(null);
  };

  const selectedActor =
    selection?.kind === "actor"
      ? scene.actors.find((actor) => actor.id === selection.id) ?? null
      : null;
  const selectedProp =
    selection?.kind === "prop"
      ? scene.props.find((prop) => prop.id === selection.id) ?? null
      : null;

  const moveSelection = (
    entity: CreatorEntitySelection,
    x: number,
    y: number,
  ): void => {
    execute(
      entity.kind === "actor"
        ? {
            kind: "move-actor",
            sceneId: scene.id,
            actorId: entity.id,
            position: { x, y },
          }
        : {
            kind: "move-prop",
            sceneId: scene.id,
            propId: entity.id,
            position: { x, y },
          },
    );
  };

  const nudgeSelection = (
    entity: CreatorEntitySelection,
    deltaX: number,
    deltaY: number,
  ): void => {
    const actor =
      entity.kind === "actor"
        ? scene.actors.find((candidate) => candidate.id === entity.id)
        : null;
    const prop =
      entity.kind === "prop"
        ? scene.props.find((candidate) => candidate.id === entity.id)
        : null;
    const position = actor?.position ?? prop?.position;
    if (!position) return;
    moveSelection(entity, position.x + deltaX, position.y + deltaY);
  };

  const duplicateScene = (): void => {
    let suffix = 1;
    let newSceneId = `${scene.id}.variant-${suffix}`;
    while (project.scenes.some((candidate) => candidate.id === newSceneId)) {
      suffix += 1;
      newSceneId = `${scene.id}.variant-${suffix}`;
    }
    try {
      const next = executeClassicAdventureCreatorCommand(history, {
        kind: "duplicate-scene",
        sceneId: scene.id,
        newSceneId,
        name: `${scene.name} Variant ${suffix}`,
      });
      setHistory(next);
      setSceneId(newSceneId);
      setSelection(null);
      setNotice("Scene variant created with independent entity IDs.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Scene duplication failed.");
    }
  };

  const removeScene = (): void => {
    try {
      const next = executeClassicAdventureCreatorCommand(history, {
        kind: "remove-scene",
        sceneId: scene.id,
      });
      setHistory(next);
      setSceneId(firstScene(next.present).id);
      setSelection(null);
      setNotice("Scene removed without leaving broken references.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Scene removal failed.");
    }
  };

  return (
    <main className="cc-app" style={projectStyle(project)}>
      <header className="cc-topbar">
        <div className="cc-brand">
          <span className="cc-brand-mark">C</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Classic Game Creator</strong>
          </div>
        </div>
        <div className="cc-project-title">
          <span>{familyLabel(project)}</span>
          <strong>{project.title.replace(" Creator Project", "")}</strong>
        </div>
        <div className={`cc-readiness is-${report.status}`}>
          <span />
          <strong>{report.status}</strong>
          <em>{report.score}/100</em>
        </div>
      </header>

      <div className="cc-workspace">
        <aside className="cc-project-rail">
          <header>
            <span className="cc-eyebrow">FLAGSHIP ORIGINAL PROJECTS</span>
            <h1>Three complete production languages.</h1>
            <p>
              Edit native scenes, interface geometry, puzzle causality and logical timing
              without collapsing every game into one retro template.
            </p>
          </header>
          <div className="cc-project-list">
            {classicAdventureCreatorProjects.map((candidate, index) => (
              <ProjectRailButton
                key={candidate.id}
                project={candidate}
                selected={projectIndex === index}
                onClick={() => selectProject(index)}
              />
            ))}
          </div>
          <section className="cc-scene-stack">
            <header>
              <span>CONSTRUCTION SCENES</span>
              <strong>{project.scenes.length}</strong>
            </header>
            {project.scenes.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                className={candidate.id === scene.id ? "is-selected" : ""}
                onClick={() => selectScene(candidate.id)}
              >
                <span>{sceneKindLabel(candidate)}</span>
                <strong>{candidate.name}</strong>
              </button>
            ))}
          </section>
          <footer>
            <span>{project.nativeSize.width} × {project.nativeSize.height}</span>
            <span>{project.palette.maxColours} colours</span>
            <span>{dirty ? "unsaved edits" : "saved"}</span>
          </footer>
        </aside>

        <section className="cc-stage-column">
          <header className="cc-stage-toolbar">
            <nav aria-label="Creator surfaces">
              {surfaceTabs.map((tab) => (
                <Button
                  key={tab.id}
                  active={surface === tab.id}
                  onClick={() => setSurface(tab.id)}
                >
                  <strong>{tab.label}</strong>
                  <span>{tab.note}</span>
                </Button>
              ))}
            </nav>
            <div className="cc-history-actions">
              <Button
                disabled={history.past.length === 0}
                onClick={() => setHistory(undoClassicAdventureCreatorCommand(history))}
              >
                Undo
              </Button>
              <Button
                disabled={history.future.length === 0}
                onClick={() => setHistory(redoClassicAdventureCreatorCommand(history))}
              >
                Redo
              </Button>
              <Button
                className="is-primary"
                onClick={() => {
                  setHistory(markClassicAdventureCreatorSaved(history));
                  setNotice("Blueprint marked saved.");
                }}
              >
                Save
              </Button>
              <Button onClick={() => downloadProject(project)}>Export JSON</Button>
            </div>
          </header>

          {notice ? <div className="cc-notice">{notice}</div> : null}

          <div className="cc-stage-scroll">
            {surface === "scene" ? (
              <>
                <header className="cc-scene-heading">
                  <div>
                    <span className="cc-eyebrow">{sceneKindLabel(scene)} CONSTRUCTION</span>
                    <h1>{scene.name}</h1>
                    <p>{scene.playerGoal}</p>
                  </div>
                  <div>
                    <code>{scene.sourcePlateId}</code>
                    <strong>{scene.interfaceSafeRect.height}px active frame</strong>
                  </div>
                </header>
                <CreatorNativePreview
                  project={project}
                  scene={scene}
                  selection={selection}
                  onSelect={setSelection}
                  onNudge={nudgeSelection}
                />
                <section className="cc-native-proof-grid">
                  {scene.reviewProofs.map((proof, index) => (
                    <article key={proof}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{proof}</p>
                    </article>
                  ))}
                </section>
              </>
            ) : surface === "interface" ? (
              <InterfaceSurface project={project} scene={scene} />
            ) : surface === "puzzles" ? (
              <PuzzleSurface project={project} />
            ) : (
              <TimingSurface project={project} />
            )}
          </div>
        </section>

        <CreatorInspector
          project={project}
          scene={scene}
          surface={surface}
          selection={selection}
          selectedActor={selectedActor}
          selectedProp={selectedProp}
          report={report}
          execute={execute}
          moveSelection={moveSelection}
          duplicateScene={duplicateScene}
          removeScene={removeScene}
          onSelect={setSelection}
        />
      </div>
    </main>
  );
};
