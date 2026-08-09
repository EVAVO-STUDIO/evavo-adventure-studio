import type {
  AdventureSceneReadabilityReport,
  AdventureSceneReadabilitySeverity,
} from "@evavo/adventure-design/scene-readability";
import type { CSSProperties } from "react";
import { Button, FindingCard, Metric, SceneOverlay } from "./scene-readability-components.js";

export type SceneReadabilityView = "overlay" | "findings" | "handoff";
export type SceneReadabilityFindingFilter = "all" | AdventureSceneReadabilitySeverity;

export const OverlayView = ({ report }: { readonly report: AdventureSceneReadabilityReport }) => (
  <div className="cmp-overlay-view">
    <SceneOverlay report={report} />
    <section className="cmp-score-strip">
      <div
        className={`cmp-score-dial is-${report.status}`}
        style={{ "--cmp-score": report.score } as CSSProperties}
      >
        <strong>{report.score}</strong>
        <span>/100</span>
      </div>
      <div>
        <span className="cmp-eyebrow">NATIVE COMPOSITION READINESS</span>
        <h1>{report.sceneName}</h1>
        <p>
          Geometry is evaluated in the same coordinate system used by navigation, interaction, depth and final
          pixels. The overlay is a production proof, not a substitute for viewing the finished background and
          actor sprites at 1×.
        </p>
      </div>
      <dl>
        <Metric
          label="Walk coverage"
          value={report.metrics.navigationCoveragePercent.toFixed(1)}
          suffix="%"
        />
        <Metric
          label="Hotspot coverage"
          value={report.metrics.hotspotCoveragePercent.toFixed(1)}
          suffix="%"
        />
        <Metric label="Depth span" value={report.metrics.walkableVerticalSpanPercent.toFixed(1)} suffix="%" />
      </dl>
    </section>
  </div>
);

export const FindingsView = ({
  report,
  filter,
  onFilter,
}: {
  readonly report: AdventureSceneReadabilityReport;
  readonly filter: SceneReadabilityFindingFilter;
  readonly onFilter: (filter: SceneReadabilityFindingFilter) => void;
}) => {
  const findings = report.findings.filter((finding) => filter === "all" || finding.severity === filter);
  return (
    <section className="cmp-findings-view">
      <header>
        <div>
          <span className="cmp-eyebrow">GEOMETRY REVIEW QUEUE</span>
          <h1>
            {report.findings.length === 0
              ? "No geometry findings"
              : `${report.findings.length} geometry findings`}
          </h1>
        </div>
        <div className="cmp-filter-row">
          {(["all", "error", "warning", "note"] as const).map((value) => (
            <Button key={value} active={filter === value} onClick={() => onFilter(value)}>
              {value}
            </Button>
          ))}
        </div>
      </header>
      {findings.length > 0 ? (
        <div className="cmp-finding-list">
          {findings.map((finding) => (
            <FindingCard key={`${finding.id}-${finding.path}`} finding={finding} />
          ))}
        </div>
      ) : (
        <div className="cmp-empty-state">
          <strong>The current scene satisfies this filter.</strong>
          <p>Continue with native artwork, actor-scale, occlusion and playtest review.</p>
        </div>
      )}
    </section>
  );
};

export const HandoffView = ({ report }: { readonly report: AdventureSceneReadabilityReport }) => (
  <section className="cmp-handoff-view">
    <header>
      <span className="cmp-eyebrow">LEVEL AND ART HANDOFF</span>
      <h1>{report.designLink?.locationName ?? report.sceneName}</h1>
      <p>
        Use this page as the shared review boundary between background art, actor animation, level geometry,
        interaction authoring and runtime implementation.
      </p>
    </header>
    <div className="cmp-handoff-grid">
      <article>
        <span>Visual promise</span>
        <h2>Background composition</h2>
        <p>
          {report.designLink?.artBrief ??
            "No linked Adventure Design location brief has been authored for this scene."}
        </p>
      </article>
      <article>
        <span>Arrival beat</span>
        <h2>First playable read</h2>
        <p>
          {report.designLink?.arrivalBeat ??
            "Link the scene to a Design Director location before final staging review."}
        </p>
      </article>
      <article>
        <span>Navigation</span>
        <h2>Actor stage lane</h2>
        <p>
          {report.metrics.navigationAreaCount} authored area(s), covering{" "}
          {report.metrics.navigationCoveragePercent.toFixed(1)}% of the native canvas and{" "}
          {report.metrics.walkableVerticalSpanPercent.toFixed(1)}% of its vertical depth.
        </p>
      </article>
      <article>
        <span>Interaction</span>
        <h2>Consequential targets</h2>
        <p>
          {report.metrics.hotspotCount} hotspot(s), {report.metrics.exitHotspotCount} explicit exit(s), and{" "}
          {report.metrics.hotspotCoveragePercent.toFixed(1)}% total target coverage.
        </p>
      </article>
      <article>
        <span>Depth and occlusion</span>
        <h2>Foreground continuity</h2>
        <p>
          {report.metrics.depthBandCount} depth band(s), {report.metrics.occluderCount} occluder(s), and{" "}
          {report.metrics.entranceCount} controlled arrival point(s).
        </p>
      </article>
      <article>
        <span>Review gate</span>
        <h2>Before asset lock</h2>
        <ul>
          <li>View background, actors and interface at 1× native size.</li>
          <li>Trace every entrance, exit and walk-to point without hotspot assistance.</li>
          <li>Confirm depth scale never changes character identity or readability.</li>
          <li>Test foreground masks during movement, dialogue and state changes.</li>
          <li>Verify decorative detail never competes with consequential props.</li>
        </ul>
      </article>
    </div>
  </section>
);
