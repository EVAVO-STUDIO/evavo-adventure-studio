import { mergeActorsIntoProject } from "@evavo/adventure-animation-editor-core/project-integration";
import type { Actor, AdventureProject } from "@evavo/adventure-project-schema";
import type { AnimationWorkspaceState } from "./animation-workspace.js";

export const animationWorkspaceActors = (
  state: AnimationWorkspaceState,
): readonly Actor[] =>
  state.actorOrder.map((actorId) => {
    const actor = state.histories[actorId]?.document.actor;
    if (!actor) {
      throw new Error(`Animation workspace actor '${actorId}' is missing.`);
    }
    return actor;
  });

export const projectFromAnimationWorkspace = (
  project: AdventureProject,
  state: AnimationWorkspaceState,
): AdventureProject =>
  mergeActorsIntoProject(project, animationWorkspaceActors(state));

export const downloadProjectFromAnimationWorkspace = (
  project: AdventureProject,
  state: AnimationWorkspaceState,
): void => {
  const merged = projectFromAnimationWorkspace(project, state);
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(merged, null, 2)}\n`], {
      type: "application/json",
    }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${merged.id}.project.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
