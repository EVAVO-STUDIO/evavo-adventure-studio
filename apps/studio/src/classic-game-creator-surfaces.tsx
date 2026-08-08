import type {
  ClassicAdventureCreatorProject,
  ClassicAdventureCreatorScene,
} from "@evavo/adventure-design/classic-game-creator";
import { CreatorNativePreview } from "./classic-game-creator-preview.js";
import { RangeField, timingControls } from "./classic-game-creator-controls.js";

export const InterfaceSurface = ({
  project,
  scene,
}: {
  readonly project: ClassicAdventureCreatorProject;
  readonly scene: ClassicAdventureCreatorScene;
}) => (
  <div className="cc-interface-surface">
    <CreatorNativePreview
      project={project}
      scene={scene}
      selection={null}
      onSelect={() => undefined}
      onNudge={() => undefined}
    />
    <div className="cc-interface-contract-grid">
      <article>
        <span>FAMILY</span>
        <h2>{project.interface.family.replaceAll("-", " ")}</h2>
        <p>{project.interface.cursorDoctrine}</p>
      </article>
      <article>
        <span>CANVAS CLAIM</span>
        <h2>
          {project.interface.gameplayViewportHeight}px game · {project.interface.chromeHeight}px chrome
        </h2>
        <p>{project.interface.statusPlacement}</p>
      </article>
      <article>
        <span>COMMAND LANGUAGE</span>
        <div className="cc-token-list">
          {project.interface.verbs.map((verb) => (
            <code key={verb}>{verb}</code>
          ))}
        </div>
      </article>
      <article>
        <span>DIALOGUE</span>
        <h2>
          {project.interface.portraitSlots > 0
            ? `${project.interface.portraitSlots} portrait anchors`
            : "in-scene performance"}
        </h2>
        <p>
          {project.interface.topicRows > 0
            ? `${project.interface.topicRows} evidence-led topic rows`
            : "Dialogue returns immediately to object play."}
        </p>
      </article>
    </div>
  </div>
);

export const PuzzleSurface = ({ project }: { readonly project: ClassicAdventureCreatorProject }) => (
  <div className="cc-puzzle-surface">
    {project.puzzles.map((puzzle) => (
      <article className="cc-puzzle-card" key={puzzle.id}>
        <header>
          <div>
            <span>{puzzle.grammar.replaceAll("-", " ")}</span>
            <h2>{puzzle.title}</h2>
          </div>
          <code>{puzzle.id}</code>
        </header>
        <ol>
          {puzzle.steps.map((step, index) => (
            <li key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        <div className="cc-puzzle-outcomes">
          <section>
            <span>RESULT</span>
            <p>{puzzle.result}</p>
          </section>
          <section>
            <span>RECOVERY</span>
            <p>{puzzle.recovery}</p>
          </section>
        </div>
      </article>
    ))}
    <section className="cc-dialogue-structure">
      {project.dialogues.map((dialogue) => (
        <article key={dialogue.id}>
          <header>
            <span>{dialogue.mode.replaceAll("-", " ")}</span>
            <h2>{dialogue.openingLine}</h2>
          </header>
          <div className="cc-topic-grid">
            {dialogue.topics.map((topic) => (
              <code key={topic}>{topic}</code>
            ))}
          </div>
          <ul>
            {dialogue.stateChanges.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  </div>
);

export const TimingSurface = ({ project }: { readonly project: ClassicAdventureCreatorProject }) => (
  <div className="cc-timing-surface">
    <header>
      <span>CANONICAL LOGICAL CLOCK</span>
      <strong>{project.timing.logicalTicksPerSecond} ticks per second</strong>
      <p>
        Authored holds change the rhythm. Browser refresh rate never changes puzzle,
        movement, dialogue or camera consequences.
      </p>
    </header>
    <div className="cc-timing-chart">
      {timingControls.map((control) => {
        const value = project.timing[control.field];
        const width = Math.max(
          4,
          ((value - control.minimum) / (control.maximum - control.minimum)) * 100,
        );
        return (
          <article key={control.field}>
            <div>
              <span>{control.label}</span>
              <strong>{value}t</strong>
            </div>
            <div className="cc-timing-track">
              <span style={{ width: `${width}%` }} />
            </div>
            <p>{control.note}</p>
          </article>
        );
      })}
    </div>
  </div>
);
