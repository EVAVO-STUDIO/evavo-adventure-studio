import {
  type AdventureProductionProfile,
  adventureProductionProfiles,
} from "@evavo/adventure-design/production-profiles";
import {
  adventureProductionShowcaseByProfileId,
  adventureProductionShowcases,
  validateAdventureProductionShowcase,
} from "@evavo/adventure-design/production-showcases";
import { useEffect, useMemo, useState } from "react";
import { profileStyle } from "./production-profile-preview.js";
import {
  NativeShowcasePlate,
  PlateButton,
  ShowcaseFamilyButton,
} from "./showcase-gallery-components.js";
import "./showcase-gallery.css";
import "./showcase-gallery-native.css";

const profileById = new Map(
  adventureProductionProfiles.map((profile) => [profile.id as string, profile] as const),
);

const selectedProfile = (profileId: string): AdventureProductionProfile => {
  const profile = profileById.get(profileId);
  if (!profile) throw new Error(`Production profile '${profileId}' is missing.`);
  return profile;
};

export const ShowcaseGalleryApp = () => {
  const [showcaseIndex, setShowcaseIndex] = useState(0);
  const [plateIndex, setPlateIndex] = useState(1);
  const showcase = adventureProductionShowcases[showcaseIndex] ?? adventureProductionShowcases[0]!;
  const profile = selectedProfile(showcase.profileId);
  const plate = showcase.plates[plateIndex] ?? showcase.plates[0]!;
  const issues = useMemo(() => validateAdventureProductionShowcase(showcase), [showcase]);
  const profileShowcase = useMemo(
    () => adventureProductionShowcaseByProfileId(profile.id, adventureProductionShowcases),
    [profile.id],
  );

  useEffect(() => {
    setPlateIndex(1);
  }, [showcaseIndex]);

  return (
    <main className="scg-app" style={profileStyle(profile)}>
      <header className="scg-topbar">
        <div className="scg-brand">
          <span className="scg-brand-mark">S</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Native Showcase Gallery</strong>
          </div>
        </div>
        <div className="scg-topbar-meta">
          <span>{profile.label}</span>
          <strong>
            {profile.nativeSize.width} × {profile.nativeSize.height}
          </strong>
        </div>
        <div className={`scg-ready-state${issues.length === 0 ? " is-ready" : " is-blocked"}`}>
          <span />
          <strong>{issues.length === 0 ? "showcase ready" : `${issues.length} findings`}</strong>
        </div>
      </header>

      <div className="scg-workspace">
        <aside className="scg-family-rail">
          <header>
            <span className="scg-eyebrow">ORIGINAL NATIVE PROTOTYPES</span>
            <h1>Nine visibly different games.</h1>
            <p>
              Every example carries its own screen composition, actor language, interface, puzzle grammar,
              splash and system treatment.
            </p>
          </header>
          <div className="scg-family-list">
            {adventureProductionShowcases.map((candidate, index) => (
              <ShowcaseFamilyButton
                key={candidate.id}
                showcase={candidate}
                profile={selectedProfile(candidate.profileId)}
                selected={index === showcaseIndex}
                onClick={() => setShowcaseIndex(index)}
              />
            ))}
          </div>
          <footer>
            <span>{adventureProductionShowcases.length} original showcases</span>
            <span>4 native plates each</span>
          </footer>
        </aside>

        <section className="scg-stage-column">
          <header className="scg-showcase-heading">
            <div>
              <span className="scg-eyebrow">{showcase.genre}</span>
              <h1>{showcase.title}</h1>
              <p>{showcase.logline}</p>
            </div>
            <div className="scg-profile-chip">
              <span>{profile.interface.family.replaceAll("-", " ")}</span>
              <strong>{profile.palette.maxColours} colours</strong>
            </div>
          </header>

          <nav className="scg-plate-tabs" aria-label="Showcase plates">
            {showcase.plates.map((candidate, index) => (
              <PlateButton
                key={candidate.id}
                plate={candidate}
                active={index === plateIndex}
                onClick={() => setPlateIndex(index)}
              />
            ))}
          </nav>

          <section className="scg-native-stage">
            <NativeShowcasePlate showcase={profileShowcase} plate={plate} profile={profile} />
            <div className="scg-native-caption">
              <span>1× native construction plate</span>
              <code>{plate.id}</code>
            </div>
          </section>

          <section className="scg-proof-grid">
            {plate.visualProofs.map((proof, index) => (
              <article key={proof}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{proof}</p>
              </article>
            ))}
          </section>
        </section>

        <aside className="scg-inspector">
          <section>
            <span className="scg-eyebrow">PLAYER GOAL</span>
            <h2>{plate.name}</h2>
            <p>{plate.playerGoal}</p>
          </section>

          <section>
            <span className="scg-eyebrow">PLATE METRICS</span>
            <dl>
              <div>
                <dt>Actors</dt>
                <dd>{plate.actors.length}</dd>
              </div>
              <div>
                <dt>Props</dt>
                <dd>{plate.props.length}</dd>
              </div>
              <div>
                <dt>Interactive</dt>
                <dd>{plate.props.filter((prop) => prop.interactive).length}</dd>
              </div>
              <div>
                <dt>Horizon</dt>
                <dd>{plate.horizonY}px</dd>
              </div>
              <div>
                <dt>Focus</dt>
                <dd>
                  {plate.focalPoint.x},{plate.focalPoint.y}
                </dd>
              </div>
            </dl>
          </section>

          <section className="scg-treatment">
            <span className="scg-eyebrow">PROFILE TREATMENT</span>
            <h2>
              {plate.kind === "title"
                ? showcase.titleTreatment
                : plate.kind === "dialogue"
                  ? showcase.dialogueTreatment
                  : plate.kind === "system"
                    ? showcase.systemTreatment
                    : profile.scene.focalHierarchy}
            </h2>
          </section>

          <section>
            <span className="scg-eyebrow">PUZZLE PROOF</span>
            <div className="scg-puzzle-list">
              {showcase.puzzleBeats.map((beat) => (
                <article key={beat.id}>
                  <header>
                    <strong>{beat.grammar.replaceAll("-", " ")}</strong>
                    <code>{beat.id}</code>
                  </header>
                  <p>{beat.prompt}</p>
                  <dl>
                    <div>
                      <dt>Action</dt>
                      <dd>{beat.playerAction}</dd>
                    </div>
                    <div>
                      <dt>Result</dt>
                      <dd>{beat.result}</dd>
                    </div>
                    <div>
                      <dt>Recovery</dt>
                      <dd>{beat.recovery}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <section className="scg-originality">
            <span className="scg-eyebrow">ORIGINALITY BOUNDARY</span>
            <p>{showcase.originalityStatement}</p>
          </section>

          <footer>
            <span>Showcase v{showcase.showcaseVersion}</span>
            <code>{showcase.id}</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
