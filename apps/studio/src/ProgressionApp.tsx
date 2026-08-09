import {
  type AdventureProgressionSeverity,
  evaluateAdventureProgression,
} from "@evavo/adventure-design/progression";
import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Metric,
  MilestonesView,
  ProgressionButton,
  type ProgressionFindingFilter,
  type ProgressionView,
  RisksView,
  StatusPip,
  WorldFlowView,
} from "./progression-components.js";
import { progressionDesign, progressionProject, progressionScenarios } from "./progression-fixture.js";
import "./progression.css";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

export const ProgressionApp = () => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [view, setView] = useState<ProgressionView>("flow");
  const [filter, setFilter] = useState<ProgressionFindingFilter>("all");
  const scenario = progressionScenarios[scenarioIndex] ?? progressionScenarios[0]!;
  const report = useMemo(
    () =>
      evaluateAdventureProgression(progressionProject, progressionDesign, scenario.sceneInstances, {
        maximumStates: 4096,
        maximumDepth: 64,
        maximumWitnessSteps: 18,
        maximumNestedRequests: 16,
        maximumTerminalStates: 24,
      }),
    [scenario],
  );

  useEffect(() => {
    setFilter("all");
  }, [scenarioIndex]);

  const count = (severity: AdventureProgressionSeverity): number =>
    report.findings.filter((finding) => finding.severity === severity).length;
  const nextFinding = report.findings[0] ?? null;

  return (
    <main className="prg-app">
      <header className="prg-topbar">
        <div className="prg-brand">
          <span className="prg-brand-mark">F</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Progression Flow Lab</strong>
          </div>
        </div>
        <label className="prg-scenario-picker">
          <span>Production scenario</span>
          <select
            value={scenarioIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setScenarioIndex(Number(event.currentTarget.value))
            }
          >
            {progressionScenarios.map((candidate, index) => (
              <option key={candidate.id} value={index}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`prg-ready-state is-${report.status}`}>
          <StatusPip status={report.status} />
          <span>{report.status}</span>
        </div>
      </header>

      <nav className="prg-toolbar" aria-label="Progression Flow Lab views">
        <div>
          <ProgressionButton active={view === "flow"} onClick={() => setView("flow")}>
            World flow
          </ProgressionButton>
          <ProgressionButton active={view === "milestones"} onClick={() => setView("milestones")}>
            Milestones
          </ProgressionButton>
          <ProgressionButton active={view === "risks"} onClick={() => setView("risks")}>
            Risks
          </ProgressionButton>
        </div>
        <p>Bounded canonical state exploration · shortest witnesses · branch recovery</p>
      </nav>

      <div className="prg-workspace">
        <aside className="prg-rail">
          <section>
            <span className="prg-eyebrow">PROGRESSION CONTRACT</span>
            <h1>{progressionProject.title}</h1>
            <code>{scenario.id}</code>
          </section>
          <dl className="prg-metrics">
            <Metric
              label="Objectives"
              value={`${report.metrics.objectiveCoverage}/${report.metrics.objectiveTotal}`}
            />
            <Metric
              label="Scenes"
              value={`${report.metrics.reachableSceneCount}/${report.metrics.totalSceneCount}`}
            />
            <Metric
              label="Items"
              value={`${report.metrics.obtainableItemCount}/${report.metrics.totalItemCount}`}
            />
            <Metric
              label="Dialogues"
              value={`${report.metrics.reachableDialogueCount}/${report.metrics.totalDialogueCount}`}
            />
            <Metric
              label="Sequences"
              value={`${report.metrics.reachableSequenceCount}/${report.metrics.totalSequenceCount}`}
            />
            <Metric label="States" value={report.metrics.exploredStates} />
            <Metric label="Transitions" value={report.metrics.exploredTransitions} />
          </dl>
          <section className="prg-score">
            <span className="prg-eyebrow">OBJECTIVE COVERAGE</span>
            <div>
              <strong>{report.metrics.objectiveCoveragePercent}</strong>
              <span>%</span>
            </div>
          </section>
          <section className="prg-severity-summary">
            <div className="is-error">
              <span>Errors</span>
              <strong>{count("error")}</strong>
            </div>
            <div className="is-warning">
              <span>Warnings</span>
              <strong>{count("warning")}</strong>
            </div>
            <div className="is-note">
              <span>Notes</span>
              <strong>{count("note")}</strong>
            </div>
          </section>
        </aside>

        <section className="prg-canvas">
          {view === "flow" ? (
            <WorldFlowView project={progressionProject} design={progressionDesign} report={report} />
          ) : null}
          {view === "milestones" ? <MilestonesView report={report} /> : null}
          {view === "risks" ? (
            <RisksView project={progressionProject} report={report} filter={filter} onFilter={setFilter} />
          ) : null}
        </section>

        <aside className="prg-inspector">
          <section>
            <span className="prg-eyebrow">SCENARIO</span>
            <h2>{scenario.label}</h2>
            <p>{scenario.description}</p>
          </section>
          <section>
            <span className="prg-eyebrow">EXPLORER MODEL</span>
            <h2>Actual canonical consequences</h2>
            <ul>
              <li>Scene and stateful-object interactions.</li>
              <li>Inventory requirements and acquisition.</li>
              <li>Runtime-default flag and variable conditions.</li>
              <li>Dialogue entry, enabled choices and node continuation.</li>
              <li>Sequence story actions and deterministic completion.</li>
              <li>Item removal, object state and branch recovery.</li>
            </ul>
          </section>
          <section className="prg-next-action">
            <span className="prg-eyebrow">NEXT ACTION</span>
            <h2>{nextFinding?.message ?? "Preserve the verified route"}</h2>
            <p>
              {nextFinding?.recommendation ??
                "Compile the exact project and scene instances, then replay the " +
                  "shortest witness route in the Player."}
            </p>
          </section>
          <section className="prg-proof-boundary">
            <span className="prg-eyebrow">PROOF BOUNDARY</span>
            <p>
              {report.complete
                ? "The configured state space was exhausted and every required objective was reached."
                : report.truncated
                  ? "The bounded state space was not exhausted."
                  : "The explored graph does not yet reach every required objective."}
            </p>
          </section>
          <footer>
            <span>Report v{report.reportVersion}</span>
            <code>{shortId(progressionProject.id)}</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
