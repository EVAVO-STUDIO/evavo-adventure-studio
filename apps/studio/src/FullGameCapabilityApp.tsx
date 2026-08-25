import {
  adventureCapabilityCatalog,
  currentAdventureCapabilityCoverage,
  type AdventureCapabilityId,
  type AdventureCapabilityStatus,
} from "@evavo/adventure-design/full-game-capabilities";
import {
  adventureFullGameReferenceProfiles,
  evaluateAdventureFullGameReference,
} from "@evavo/adventure-design/full-game-reference-policy";
import {
  cinematicConspiracyFullGameProfile,
  evaluateCinematicConspiracyFullGame,
} from "@evavo/adventure-design/cinematic-conspiracy-full-game";
import { adventureFullGameUpgradePlan } from "@evavo/adventure-design/full-game-upgrade-plan";
import { referenceProofDevelopmentStatusByLaneId } from "@evavo/adventure-design/reference-proof-development";
import { adventureReferenceProofLanes } from "@evavo/adventure-design/reference-proof-lanes";
import { referenceProofRuntimeContractByLaneId } from "@evavo/adventure-design/reference-proof-readiness";
import { adventureSceneArchetypes } from "@evavo/adventure-design/scene-archetypes";
import { type ChangeEvent, useMemo, useState } from "react";
import "./full-game-capability.css";

const statusOrder: readonly AdventureCapabilityStatus[] = ["missing", "partial", "implemented", "proofed"];

const labelForCapability = new Map(
  adventureCapabilityCatalog.map((capability) => [capability.id, capability.label] as const),
);

type FullGameReferenceView =
  | {
      readonly kind: "classic-vga";
      readonly id: (typeof adventureFullGameReferenceProfiles)[number]["id"];
      readonly label: string;
      readonly family: string;
      readonly required: readonly AdventureCapabilityId[];
      readonly signature: readonly AdventureCapabilityId[];
      readonly stressScenes: readonly string[];
      readonly productionRules: readonly string[];
    }
  | {
      readonly kind: "modern-cinematic";
      readonly id: "broken-sword-templar-style";
      readonly label: string;
      readonly family: string;
      readonly required: readonly AdventureCapabilityId[];
      readonly signature: readonly AdventureCapabilityId[];
      readonly stressScenes: readonly string[];
      readonly productionRules: readonly string[];
    };

const referenceViews: readonly FullGameReferenceView[] = [
  ...adventureFullGameReferenceProfiles.map(
    (reference): FullGameReferenceView => ({
      kind: "classic-vga",
      id: reference.id,
      label: reference.label,
      family: reference.family,
      required: reference.required,
      signature: reference.signature,
      stressScenes: reference.stressScenes,
      productionRules: [],
    }),
  ),
  {
    kind: "modern-cinematic",
    id: cinematicConspiracyFullGameProfile.id,
    label: cinematicConspiracyFullGameProfile.label,
    family: cinematicConspiracyFullGameProfile.family,
    required: cinematicConspiracyFullGameProfile.required,
    signature: cinematicConspiracyFullGameProfile.signature,
    stressScenes: cinematicConspiracyFullGameProfile.stressScenes,
    productionRules: cinematicConspiracyFullGameProfile.productionRules,
  },
] as const;

const coverageFor = (required: ReadonlySet<AdventureCapabilityId>) =>
  currentAdventureCapabilityCoverage
    .filter((entry) => required.has(entry.id))
    .sort((left, right) => {
      const status = statusOrder.indexOf(left.status) - statusOrder.indexOf(right.status);
      if (status !== 0) return status;
      return (labelForCapability.get(left.id) ?? left.id).localeCompare(labelForCapability.get(right.id) ?? right.id);
    });

export const FullGameCapabilityApp = () => {
  const [referenceIndex, setReferenceIndex] = useState(0);
  const reference = referenceViews[referenceIndex] ?? referenceViews[0]!;
  const readiness = useMemo(
    () =>
      reference.kind === "modern-cinematic"
        ? evaluateCinematicConspiracyFullGame()
        : evaluateAdventureFullGameReference(reference.id),
    [reference],
  );
  const required = new Set<AdventureCapabilityId>(reference.required);
  const coverage = coverageFor(required);
  const archetypes =
    reference.kind === "modern-cinematic"
      ? adventureSceneArchetypes.filter((entry) =>
          entry.requiredCapabilities.some((capability) => required.has(capability)),
        )
      : adventureSceneArchetypes.filter((entry) => entry.referenceGames.includes(reference.id));
  const epics = adventureFullGameUpgradePlan
    .filter((epic) =>
      reference.kind === "modern-cinematic"
        ? epic.capabilities.some((capability) => required.has(capability))
        : epic.unlocksReferenceGames.includes(reference.id),
    )
    .sort((left, right) => left.priority - right.priority);

  return (
    <main className="fgc-app">
      <header className="fgc-topbar">
        <div>
          <span>EVAVO ADVENTURE STUDIO</span>
          <strong>Full Game Capability Lab</strong>
        </div>
        <label>
          <span>Reference pressure</span>
          <select
            value={referenceIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setReferenceIndex(Number(event.currentTarget.value))
            }
          >
            {referenceViews.map((candidate, index) => (
              <option key={candidate.id} value={index}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`fgc-ready is-${readiness.ready ? "ready" : "blocked"}`}>
          <strong>{readiness.ready ? "FULL-GAME READY" : "GAPS REMAIN"}</strong>
          <span>{readiness.proofedCount}/{readiness.requiredCount} proofed</span>
        </div>
      </header>

      <section className="fgc-hero">
        <span className="fgc-eyebrow">
          {reference.kind === "modern-cinematic" ? "MODERN CINEMATIC" : "CLASSIC VGA"} · {reference.family.replaceAll("-", " ")}
        </span>
        <h1>{reference.label}</h1>
        <p>
          A polished room is not enough. This view measures the persistent engine grammar and scene forms needed
          to produce a complete game in this reference family.
        </p>
        <div className="fgc-score-strip">
          <span><strong>{readiness.proofedCount}</strong> proofed</span>
          <span><strong>{readiness.implementedCount}</strong> implemented / unproofed</span>
          <span><strong>{readiness.partialCount}</strong> partial</span>
          <span><strong>{readiness.missingCount}</strong> missing</span>
        </div>
      </section>

      <div className="fgc-grid">
        <section className="fgc-panel fgc-capabilities">
          <header>
            <span className="fgc-eyebrow">REQUIRED ENGINE GRAMMAR</span>
            <h2>{readiness.requiredCount} capabilities</h2>
          </header>
          <div className="fgc-capability-list">
            {coverage.map((entry) => (
              <article key={entry.id} className={`is-${entry.status}`}>
                <span>{entry.status}</span>
                <div>
                  <strong>{labelForCapability.get(entry.id) ?? entry.id}</strong>
                  <p>{entry.evidence}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="fgc-panel">
          <header>
            <span className="fgc-eyebrow">SCENE ARCHETYPES UNDER PRESSURE</span>
            <h2>{archetypes.length} scene forms</h2>
          </header>
          <div className="fgc-archetypes">
            {archetypes.map((entry) => (
              <article key={entry.id}>
                <strong>{entry.label}</strong>
                <p>{entry.description}</p>
                <div>{entry.authoringSurfaces.slice(0, 5).map((surface) => <span key={surface}>{surface}</span>)}</div>
              </article>
            ))}
          </div>
        </section>

        <section className="fgc-panel">
          <header>
            <span className="fgc-eyebrow">REQUIRED STRESS PROOFS</span>
            <h2>Whole-game evidence</h2>
          </header>
          <ol className="fgc-stress-scenes">
            {reference.stressScenes.map((scene) => <li key={scene}>{scene}</li>)}
          </ol>
          <div className="fgc-signature">
            <span className="fgc-eyebrow">SIGNATURE SYSTEMS</span>
            {reference.signature.map((capabilityId) => (
              <span key={capabilityId}>{labelForCapability.get(capabilityId) ?? capabilityId}</span>
            ))}
          </div>
          {reference.productionRules.length > 0 ? (
            <div className="fgc-signature">
              <span className="fgc-eyebrow">PRODUCTION RULES</span>
              {reference.productionRules.map((rule) => <p key={rule}>{rule}</p>)}
            </div>
          ) : null}
        </section>

        <section className="fgc-panel fgc-roadmap">
          <header>
            <span className="fgc-eyebrow">CROSS-FAMILY UPGRADE PATH</span>
            <h2>{epics.length} relevant epics</h2>
          </header>
          {epics.map((epic) => (
            <article key={epic.id}>
              <span>{String(epic.priority).padStart(2, "0")}</span>
              <div>
                <strong>{epic.label}</strong>
                <p>{epic.outcome}</p>
                <small>{epic.proofScenes[0]}</small>
              </div>
            </article>
          ))}
        </section>
      </div>

      <section className="fgc-proof-lanes">
        <header>
          <div>
            <span className="fgc-eyebrow">REFERENCE PROOF LANES</span>
            <h2>Authentic grammar, repaired friction</h2>
          </div>
          <p>
            Historical lanes preserve the target era's production grammar. Modern-retro lanes are labelled as
            benchmarks. All use original worlds/assets while deliberately repairing frustration that tests
            precision or foreknowledge instead of understanding.
          </p>
        </header>
        <div className="fgc-proof-lane-grid">
          {adventureReferenceProofLanes.map((lane) => {
            const development = referenceProofDevelopmentStatusByLaneId(lane.id);
            const contract = referenceProofRuntimeContractByLaneId(lane.id);
            return (
              <article key={lane.id} className={`is-${lane.kind}`}>
                <div className="fgc-proof-lane-title">
                  <span>{lane.kind === "historical-fidelity" ? "HISTORICAL FIDELITY" : "MODERN-RETRO BENCHMARK"}</span>
                  <strong>{lane.label}</strong>
                  <small>{lane.referencePressure} · {lane.targetEra}</small>
                </div>
                <dl>
                  <div><dt>Original proof</dt><dd>{lane.showcaseId}</dd></div>
                  <div><dt>Production profile</dt><dd>{lane.profileId}</dd></div>
                  {lane.fidelityPackId ? <div><dt>Fidelity pack</dt><dd>{lane.fidelityPackId}</dd></div> : null}
                  <div><dt>Gameplay milestones</dt><dd>{contract?.requiredMilestones.length ?? 0} required</dd></div>
                </dl>
                <div className="fgc-development-stages">
                  {(development?.stages ?? []).map((entry) => (
                    <div key={entry.stage} className={`is-${entry.status}`} title={entry.note}>
                      <span>{entry.stage.replaceAll("-", " ")}</span>
                      <strong>{entry.status}</strong>
                    </div>
                  ))}
                </div>
                <div className="fgc-proof-columns">
                  <section>
                    <span className="fgc-eyebrow">MUST STAY AUTHENTIC</span>
                    <ul>{lane.authenticMustKeep.slice(0, 4).map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                  <section>
                    <span className="fgc-eyebrow">DELIBERATE REPAIRS</span>
                    <div className="fgc-repair-tags">
                      {lane.qualityRepairs.map((repair) => <span key={repair}>{repair.replaceAll("-", " ")}</span>)}
                    </div>
                  </section>
                </div>
                <div className="fgc-proof-scenes">
                  <span className="fgc-eyebrow">PROOF SCENES</span>
                  <ol>{lane.proofScenes.map((scene) => <li key={scene}>{scene}</li>)}</ol>
                </div>
                <p className="fgc-completion-rule">{lane.completionRule}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};
