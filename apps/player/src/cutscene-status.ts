import type { PlayerSystemTextResolver } from "@evavo/adventure-project-schema/localisation";

export interface PlayerCutsceneStatus {
  readonly name: string;
  readonly caption: string | null;
  readonly canSkip: boolean;
}

export const playerCutsceneStatusText = (
  state: PlayerCutsceneStatus | null,
  text: PlayerSystemTextResolver,
): string => {
  if (!state) return text("status.cutscene");
  if (state.caption) {
    return state.canSkip
      ? text("status.cutsceneCaptionSkippable", { caption: state.caption })
      : state.caption;
  }
  const name = state.name.toUpperCase();
  return state.canSkip
    ? text("status.cutsceneNameSkippable", { name })
    : name;
};
