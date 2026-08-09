import type { ReplayInspection, SaveGameInspection } from "@evavo/adventure-playtest-inspector";
import { compareReplayCheckpoint, type ReplayCheckpointComparison } from "./playtest-replay-checkpoint.js";
import "./playtest-checkpoint.css";

const checkpointCopy = (
  comparison: ReplayCheckpointComparison,
): {
  readonly label: string;
  readonly title: string;
  readonly description: string;
} => {
  switch (comparison.status) {
    case "not-recorded":
      return {
        label: "No checkpoint",
        title: "Replay did not record a final save",
        description:
          "The replay can still be inspected, but there is no recorded final-save fingerprint to compare against Save B.",
      };
    case "awaiting-after-save":
      return {
        label: "Awaiting Save B",
        title: "Load the replay's final checkpoint",
        description:
          "The replay contains an expected final-save fingerprint. Load Save B to verify that the recorded run closed on the intended state.",
      };
    case "match":
      return {
        label: "Checkpoint match",
        title: "Save B matches the replay checkpoint",
        description:
          "The loaded after-save fingerprint exactly matches the final fingerprint recorded by the replay.",
      };
    case "mismatch":
      return {
        label: "Checkpoint mismatch",
        title: "Save B diverges from the replay checkpoint",
        description:
          "The loaded after-save is valid for this bundle, but it is not the final save recorded by this replay.",
      };
  }
};

export const ReplayCheckpointPanel = ({
  replay,
  afterSave,
}: {
  readonly replay: ReplayInspection;
  readonly afterSave: SaveGameInspection | null;
}) => {
  const comparison = compareReplayCheckpoint(replay, afterSave);
  const copy = checkpointCopy(comparison);

  return (
    <section className={`playtest-card playtest-checkpoint is-${comparison.status}`} aria-live="polite">
      <div>
        <span className="playtest-eyebrow">Replay closure</span>
        <h2>{copy.title}</h2>
        <p>{copy.description}</p>
      </div>
      <div className="playtest-checkpoint-state">
        <span>Status</span>
        <strong>{copy.label}</strong>
      </div>
      <dl className="playtest-checkpoint-fingerprints">
        <div>
          <dt>Replay expected</dt>
          <dd>{comparison.expectedFingerprint ?? "Not recorded"}</dd>
        </div>
        <div>
          <dt>Loaded Save B</dt>
          <dd>{comparison.actualFingerprint ?? "Not loaded"}</dd>
        </div>
      </dl>
    </section>
  );
};
