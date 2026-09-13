import type {
  ClassicAdventureCreatorCommand,
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorReport,
  ClassicAdventureCreatorScene,
} from "@evavo/adventure-design/classic-game-creator";
import {
  Button,
  CommitText,
  type CreatorSurface,
  RangeField,
  timingControls,
} from "./classic-game-creator-controls.js";
import type { CreatorEntitySelection } from "./classic-game-creator-preview.js";

export const CreatorInspector = ({
  project,
  scene,
  surface,
  selection,
  selectedActor,
  selectedProp,
  report,
  execute,
  moveSelection,
  duplicateScene,
  removeScene,
  onSelect,
}: {
  readonly project: ClassicAdventureCreatorProject;
  readonly scene: ClassicAdventureCreatorScene;
  readonly surface: CreatorSurface;
  readonly selection: CreatorEntitySelection | null;
  readonly selectedActor: ClassicAdventureCreatorScene["actors"][number] | null;
  readonly selectedProp: ClassicAdventureCreatorScene["props"][number] | null;
  readonly report: ClassicAdventureCreatorReport;
  readonly execute: (command: ClassicAdventureCreatorCommand) => void;
  readonly moveSelection: (entity: CreatorEntitySelection, x: number, y: number) => void;
  readonly duplicateScene: () => void;
  readonly removeScene: () => void;
  readonly onSelect: (selection: CreatorEntitySelection) => void;
}) => (
  <aside className="cc-inspector">
    <section className="cc-audit-card">
      <span className="cc-eyebrow">CREATOR AUDIT</span>
      <div className="cc-score-ring">
        <strong>{report.score}</strong>
        <span>/100</span>
      </div>
      <dl>
        <div>
          <dt>Scenes</dt>
          <dd>{report.metrics.sceneCount}</dd>
        </div>
        <div>
          <dt>Targets</dt>
          <dd>{report.metrics.interactivePropCount}</dd>
        </div>
        <div>
          <dt>Topics</dt>
          <dd>{report.metrics.dialogueTopicCount}</dd>
        </div>
        <div>
          <dt>Proofs</dt>
          <dd>{report.metrics.nativeReviewProofCount}</dd>
        </div>
      </dl>
    </section>

    {surface === "scene" ? (
      <>
        <section>
          <span className="cc-eyebrow">SCENE GEOMETRY</span>
          <div className="cc-text-field">
            <span>Name</span>
            <CommitText
              value={scene.name}
              onCommit={(name) => execute({ kind: "rename-scene", sceneId: scene.id, name })}
            />
          </div>
          <RangeField
            label="Horizon"
            value={scene.horizonY}
            minimum={0}
            maximum={scene.interfaceSafeRect.height}
            onChange={(horizonY) =>
              execute({
                kind: "set-scene-horizon",
                sceneId: scene.id,
                horizonY,
              })
            }
          />
          <RangeField
            label="Walk lane top"
            value={scene.walkLane.top}
            minimum={0}
            maximum={scene.interfaceSafeRect.height - 1}
            onChange={(top) =>
              execute({
                kind: "set-walk-lane",
                sceneId: scene.id,
                top,
                bottom: scene.walkLane.bottom,
              })
            }
          />
          <RangeField
            label="Walk lane bottom"
            value={scene.walkLane.bottom}
            minimum={1}
            maximum={scene.interfaceSafeRect.height}
            onChange={(bottom) =>
              execute({
                kind: "set-walk-lane",
                sceneId: scene.id,
                top: scene.walkLane.top,
                bottom,
              })
            }
          />
        </section>

        <section className="cc-layer-section">
          <span className="cc-eyebrow">ART AND LAYER STACK</span>
          <p>{scene.artBrief}</p>
          <p className="cc-lighting-brief">{scene.lightingBrief}</p>
          <div className="cc-layer-list">
            {scene.layers
              .slice()
              .sort((left, right) => right.depth - left.depth)
              .map((layer) => (
                <article key={layer.id}>
                  <span>{layer.depth}</span>
                  <div>
                    <strong>{layer.name}</strong>
                    <small>{layer.artBrief}</small>
                  </div>
                  <em>{layer.locked ? "locked" : layer.role}</em>
                </article>
              ))}
          </div>
        </section>

        <section>
          <span className="cc-eyebrow">ENTITY STAGING</span>
          <div className="cc-entity-list">
            {scene.actors.map((actor) => (
              <button
                type="button"
                key={actor.id}
                className={selection?.kind === "actor" && selection.id === actor.id ? "is-selected" : ""}
                onClick={() => onSelect({ kind: "actor", id: actor.id })}
              >
                <span>ACTOR · {actor.role}</span>
                <strong>{actor.name}</strong>
                <small>
                  {actor.position.x}, {actor.position.y}
                </small>
              </button>
            ))}
            {scene.props.map((prop) => (
              <button
                type="button"
                key={prop.id}
                className={selection?.kind === "prop" && selection.id === prop.id ? "is-selected" : ""}
                onClick={() => onSelect({ kind: "prop", id: prop.id })}
              >
                <span>PROP · {prop.role}</span>
                <strong>{prop.name}</strong>
                <small>
                  {prop.position.x}, {prop.position.y}
                </small>
              </button>
            ))}
          </div>
        </section>

        {selectedActor || selectedProp ? (
          <section className="cc-selected-entity">
            <span className="cc-eyebrow">SELECTED ENTITY</span>
            <h2>{selectedActor?.name ?? selectedProp?.name}</h2>
            <p>{selectedActor?.silhouetteNote ?? selectedProp?.description}</p>
            <RangeField
              label="Native X"
              value={(selectedActor ?? selectedProp)?.position.x ?? 0}
              minimum={0}
              maximum={selectedProp ? 320 - selectedProp.size.width : 320}
              onChange={(x) => {
                if (!selection) return;
                const y = (selectedActor ?? selectedProp)?.position.y ?? 0;
                moveSelection(selection, x, y);
              }}
            />
            <RangeField
              label="Native Y"
              value={(selectedActor ?? selectedProp)?.position.y ?? 0}
              minimum={0}
              maximum={
                selectedProp
                  ? scene.interfaceSafeRect.height - selectedProp.size.height
                  : scene.interfaceSafeRect.height
              }
              onChange={(y) => {
                if (!selection) return;
                const x = (selectedActor ?? selectedProp)?.position.x ?? 0;
                moveSelection(selection, x, y);
              }}
            />
            <small>Arrow keys nudge 1 pixel; Shift + arrow nudges 8.</small>
          </section>
        ) : null}

        <section className="cc-scene-actions">
          <span className="cc-eyebrow">SCENE OPERATIONS</span>
          <Button onClick={duplicateScene}>Duplicate variant</Button>
          <Button className="is-danger" onClick={removeScene}>
            Remove safely
          </Button>
        </section>
      </>
    ) : surface === "interface" ? (
      <section>
        <span className="cc-eyebrow">INTERFACE GEOMETRY</span>
        <h2>{project.interface.family.replaceAll("-", " ")}</h2>
        <p>{project.interface.cursorDoctrine}</p>
        {project.interface.family === "persistent-verb-panel" ? (
          <RangeField
            label="Chrome height"
            value={project.interface.chromeHeight}
            minimum={52}
            maximum={72}
            onChange={(chromeHeight) => execute({ kind: "set-interface-chrome", chromeHeight })}
          />
        ) : (
          <dl className="cc-detail-list">
            <div>
              <dt>Open</dt>
              <dd>{project.interface.openBehaviour}</dd>
            </div>
            <div>
              <dt>Overlay</dt>
              <dd>{project.interface.overlayHeight}px</dd>
            </div>
            <div>
              <dt>Portraits</dt>
              <dd>{project.interface.portraitSlots}</dd>
            </div>
            <div>
              <dt>Topics</dt>
              <dd>{project.interface.topicRows}</dd>
            </div>
          </dl>
        )}
      </section>
    ) : surface === "puzzles" ? (
      <section>
        <span className="cc-eyebrow">RECOVERABILITY CONTRACT</span>
        <h2>No silent dead ends.</h2>
        <p>{project.puzzles[0]?.recovery}</p>
        <dl className="cc-detail-list">
          <div>
            <dt>Puzzles</dt>
            <dd>{project.puzzles.length}</dd>
          </div>
          <div>
            <dt>Dialogs</dt>
            <dd>{project.dialogues.length}</dd>
          </div>
          <div>
            <dt>Required props</dt>
            <dd>{project.puzzles[0]?.requiredPropIds.length ?? 0}</dd>
          </div>
        </dl>
      </section>
    ) : (
      <section>
        <span className="cc-eyebrow">TIMING TUNING</span>
        <div className="cc-timing-controls">
          {timingControls.map((control) => (
            <div key={control.field}>
              <RangeField
                label={control.label}
                value={project.timing[control.field]}
                minimum={control.minimum}
                maximum={control.maximum}
                onChange={(value) =>
                  execute({
                    kind: "set-timing",
                    field: control.field,
                    value,
                  })
                }
              />
              <p>{control.note}</p>
            </div>
          ))}
        </div>
      </section>
    )}

    <section className="cc-findings">
      <span className="cc-eyebrow">FINDINGS</span>
      {report.issues.length === 0 ? (
        <p className="is-clean">
          Native geometry, interface grammar, causal recovery and originality boundaries are coherent.
        </p>
      ) : (
        report.issues.slice(0, 8).map((finding) => (
          <article key={`${finding.path}:${finding.code}`}>
            <header>
              <strong>{finding.severity}</strong>
              <code>{finding.code}</code>
            </header>
            <p>{finding.message}</p>
            <small>{finding.recommendation}</small>
          </article>
        ))
      )}
    </section>

    <footer>
      <span>Creator contract v{project.creatorVersion}</span>
      <code>{project.id}</code>
    </footer>
  </aside>
);
