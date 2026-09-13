import {
  auditClassicExperience,
  type ClassicExperiencePrincipleResult,
} from "@evavo/adventure-design/classic-experience";
import { classicAdventureCreatorProjects } from "@evavo/adventure-design/classic-game-creator";
import { useMemo, useState } from "react";
import "./classic-experience.css";

const principleLabel = (principle: ClassicExperiencePrincipleResult): string =>
  principle.id.replaceAll("-", " ");

const defaultClassicAdventureProject = classicAdventureCreatorProjects[0];
if (!defaultClassicAdventureProject) {
  throw new Error("Classic Experience requires at least one creator project.");
}

export const ClassicExperienceApp = () => {
  const [projectIndex, setProjectIndex] = useState(1);
  const project = classicAdventureCreatorProjects[projectIndex] ?? defaultClassicAdventureProject;
  const report = useMemo(() => auditClassicExperience(project), [project]);

  return (
    <main className={`cxe-app cxe-family-${project.family}`}>
      <header className="cxe-topbar">
        <div className="cxe-brand">
          <span className="cxe-brand-mark">PX</span>
          <div>
            <small>EVAVO ADVENTURE STUDIO</small>
            <strong>Classic Experience &amp; Polish Lab</strong>
          </div>
        </div>
        <div className={`cxe-score is-${report.status}`}>
          <span>{report.status}</span>
          <strong>{report.score}</strong>
          <small>/100</small>
        </div>
      </header>

      <div className="cxe-layout">
        <aside className="cxe-projects">
          <header>
            <span>FLAGSHIP EXPERIENCE PROFILES</span>
            <h1>Period character. Modern respect.</h1>
            <p>
              Preserve native art, expressive timing and interface identity while removing dead ends, parser
              friction and mandatory failure.
            </p>
          </header>
          <div className="cxe-project-list">
            {classicAdventureCreatorProjects.map((candidate, index) => (
              <button
                key={candidate.id}
                className={index === projectIndex ? "is-active" : ""}
                type="button"
                onClick={() => setProjectIndex(index)}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{candidate.title.replace(" Creator Project", "")}</strong>
                  <small>{candidate.family.replaceAll("-", " ")}</small>
                </div>
              </button>
            ))}
          </div>
          <footer>
            <span>Contract v{report.contract.contractVersion}</span>
            <code>{report.findings.length} finding(s)</code>
          </footer>
        </aside>

        <section className="cxe-stage">
          <header className="cxe-heading">
            <div>
              <span>SELECTED EXPERIENCE CONTRACT</span>
              <h1>{report.contract.label}</h1>
              <p>{report.contract.designPromise}</p>
            </div>
            <dl>
              <div>
                <dt>Canvas</dt>
                <dd>
                  {project.nativeSize.width} × {project.nativeSize.height}
                </dd>
              </div>
              <div>
                <dt>Input</dt>
                <dd>{project.timing.pointerAcknowledgeTicks} tick</dd>
              </div>
              <div>
                <dt>Wrong action</dt>
                <dd>{report.metrics.averageWrongActionSeconds}s</dd>
              </div>
              <div>
                <dt>Recovery</dt>
                <dd>
                  {report.metrics.recoverablePuzzleCount}/{report.metrics.puzzleCount}
                </dd>
              </div>
            </dl>
          </header>

          <section className="cxe-native-frame" aria-label="Native polish contract preview">
            <div className="cxe-rain" />
            <div className="cxe-room-depth cxe-room-depth-far" />
            <div className="cxe-room-depth cxe-room-depth-mid" />
            <div className="cxe-room-depth cxe-room-depth-near" />
            <div className="cxe-window">
              <i />
              <i />
              <i />
            </div>
            <div className="cxe-prop cxe-prop-clue" />
            <div className="cxe-prop cxe-prop-exit" />
            <div className="cxe-actor">
              <i className="cxe-actor-head" />
              <i className="cxe-actor-coat" />
              <i className="cxe-actor-leg cxe-actor-leg-left" />
              <i className="cxe-actor-leg cxe-actor-leg-right" />
            </div>
            <div className="cxe-status-line">
              <span>{project.scenes.find((scene) => scene.kind === "gameplay")?.statusText}</span>
            </div>
            <div className="cxe-native-badge">320 × 200 • 1× REVIEW</div>
          </section>

          <section className="cxe-principles">
            {report.principles.map((principle, index) => (
              <article key={principle.id} className={principle.passed ? "is-pass" : "is-fail"}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{principleLabel(principle)}</h2>
                  {principle.evidence.map((evidence) => (
                    <p key={evidence}>{evidence}</p>
                  ))}
                </div>
                <strong>{principle.passed ? "PASS" : "FIX"}</strong>
              </article>
            ))}
          </section>
        </section>

        <aside className="cxe-inspector">
          <section>
            <span>INPUT DOCTRINE</span>
            <p>{report.contract.inputDoctrine}</p>
          </section>
          <section>
            <span>PUZZLE DOCTRINE</span>
            <p>{report.contract.puzzleDoctrine}</p>
          </section>
          <section>
            <span>FAILURE DOCTRINE</span>
            <p>{report.contract.failureDoctrine}</p>
          </section>
          <section>
            <span>OPTIONAL ASSISTANCE</span>
            <p>{report.contract.hintDoctrine}</p>
          </section>
          <section>
            <span>NATIVE REVIEW</span>
            <p>{report.contract.nativeReviewDoctrine}</p>
          </section>
          <section className="cxe-timing">
            <span>FAMILY TIMING LIMITS</span>
            <dl>
              <div>
                <dt>Pointer</dt>
                <dd>≤ {report.contract.maximumPointerAcknowledgeTicks} ticks</dd>
              </div>
              <div>
                <dt>Hover</dt>
                <dd>≤ {report.contract.maximumHoverCommitTicks} ticks</dd>
              </div>
              <div>
                <dt>Wrong action</dt>
                <dd>≤ {report.contract.maximumWrongActionHoldTicks} ticks</dd>
              </div>
              <div>
                <dt>Puzzle steps</dt>
                <dd>≥ {report.contract.minimumPuzzleSteps}</dd>
              </div>
            </dl>
          </section>
          <footer>
            <span>{report.metrics.interactiveTargetCount} interactive targets</span>
            <span>{report.metrics.nativeReviewProofCount} native proofs</span>
          </footer>
        </aside>
      </div>
    </main>
  );
};
