import type { Point, Polygon } from "@evavo/adventure-project-schema";
import type { SceneDirectorDocuments } from "./scene-director-documents.js";
import type { SceneDirectorCanonicalEditingController } from "./scene-director-canonical-editor.js";
import { StagingButton } from "./scene-staging-components.js";
import "./scene-director-hotspot-controls.css";

const starterShape = (
  visual: SceneDirectorDocuments["sceneInstances"]["objectDefinitions"][number]["states"][number]["visual"],
): Polygon => {
  if (visual?.kind === "sprite-frame") {
    return {
      points: [
        { x: 0, y: 0 },
        { x: visual.sourceRect.width, y: 0 },
        { x: visual.sourceRect.width, y: visual.sourceRect.height },
        { x: 0, y: visual.sourceRect.height },
      ],
    };
  }
  const pivot: Point = visual?.pivot ?? { x: 8, y: 8 };
  return {
    points: [
      { x: pivot.x - 8, y: pivot.y - 8 },
      { x: pivot.x + 8, y: pivot.y - 8 },
      { x: pivot.x + 8, y: pivot.y + 8 },
      { x: pivot.x - 8, y: pivot.y + 8 },
    ],
  };
};

export const SceneDirectorHotspotStateControls = ({
  documents,
  sceneId,
  editing,
}: {
  readonly documents: SceneDirectorDocuments;
  readonly sceneId: string;
  readonly editing: SceneDirectorCanonicalEditingController;
}) => {
  const composition = documents.sceneInstances.scenes.find(
    (candidate) => candidate.sceneId === sceneId,
  );
  const definitions = new Map(
    documents.sceneInstances.objectDefinitions.map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );
  const rows = (composition?.objectInstances ?? []).flatMap((instance) => {
    const definition = definitions.get(instance.definitionId);
    if (!definition) return [];
    return definition.states.map((state) => ({
      instance,
      definition,
      state,
    }));
  });
  if (rows.length === 0) return null;

  return (
    <section className="dir-hotspot-state-controls">
      <header>
        <div>
          <span className="stg-eyebrow">STATEFUL EXACT TARGETS</span>
          <h2>Create or remove local hotspot geometry</h2>
        </div>
        <p>
          Targets live on reusable object states. Creation is explicit; no invisible auto-generated hotspot is
          shipped without an authored polygon.
        </p>
      </header>
      <div className="dir-hotspot-state-list">
        {rows.map(({ instance, definition, state }) => (
          <article key={`${instance.id}:${state.id}`}>
            <div>
              <strong>{definition.name}</strong>
              <span>{state.id.split(".").at(-1) ?? state.id}</span>
              <code>{instance.id}</code>
            </div>
            <div>
              <span className={`dir-hotspot-state-status${state.interactionShape ? " is-authored" : ""}`}>
                {state.interactionShape ? `${state.interactionShape.points.length} points` : "no exact target"}
              </span>
              {state.interactionShape ? (
                <StagingButton
                  onClick={() =>
                    editing.onCommitEdit({
                      kind: "set-object-state-interaction-shape",
                      definitionId: definition.id,
                      stateId: state.id,
                      shape: null,
                    })
                  }
                >
                  Remove target
                </StagingButton>
              ) : (
                <StagingButton
                  onClick={() =>
                    editing.onCommitEdit({
                      kind: "set-object-state-interaction-shape",
                      definitionId: definition.id,
                      stateId: state.id,
                      shape: starterShape(state.visual),
                    })
                  }
                >
                  Create starter target
                </StagingButton>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
