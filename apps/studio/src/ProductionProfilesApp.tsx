import {
  adventureProductionProfiles,
  auditAdventureProductionProfile,
  createAdventureProductionProfileSeed,
} from "@evavo/adventure-design/production-profiles";
import { type ChangeEvent, type ReactNode, useMemo, useState } from "react";
import {
  InterfacePreview,
  ProfileButton,
  profileStyle,
  SplashPreview,
} from "./production-profile-preview.js";
import "./production-profiles-base.css";
import "./production-profiles-preview.css";
import "./production-profiles-stage.css";
import "./production-profiles-chrome.css";

const shortId = (value: string): string => value.split(".").at(-1) ?? value;

const RuleList = ({
  title,
  children,
  items,
}: {
  readonly title: string;
  readonly children?: ReactNode;
  readonly items: readonly string[];
}) => (
  <section className="ppf-rule-section">
    <span className="ppf-eyebrow">{title}</span>
    {children}
    <ol>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  </section>
);

export const ProductionProfilesApp = () => {
  const [profileIndex, setProfileIndex] = useState(0);
  const profile = adventureProductionProfiles[profileIndex] ?? adventureProductionProfiles[0]!;
  const report = useMemo(() => auditAdventureProductionProfile(profile), [profile]);
  const seed = useMemo(() => createAdventureProductionProfileSeed(profile), [profile]);

  return (
    <main className="ppf-app" style={profileStyle(profile)}>
      <header className="ppf-topbar">
        <div className="ppf-brand">
          <span className="ppf-brand-mark">P</span>
          <div>
            <span>EVAVO ADVENTURE STUDIO</span>
            <strong>Production Profile Atelier</strong>
          </div>
        </div>
        <label className="ppf-profile-picker">
          <span>Profile</span>
          <select
            value={profileIndex}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              setProfileIndex(Number(event.currentTarget.value))
            }
          >
            {adventureProductionProfiles.map((candidate, index) => (
              <option key={candidate.id} value={index}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <div className={`ppf-ready-state is-${report.status}`}>
          <span />
          <strong>{report.status}</strong>
          <em>{report.score}/100</em>
        </div>
      </header>

      <div className="ppf-workspace">
        <aside className="ppf-profile-rail">
          <header>
            <span className="ppf-eyebrow">BUILT-IN PRODUCTION FAMILIES</span>
            <h1>Not one retro filter.</h1>
            <p>
              Each family owns its canvas, palette, scene staging, actor performance, interface, puzzle
              grammar, sound and original publisher splash.
            </p>
          </header>
          <div className="ppf-profile-list">
            {adventureProductionProfiles.map((candidate, index) => (
              <ProfileButton
                key={candidate.id}
                profile={candidate}
                selected={index === profileIndex}
                onClick={() => setProfileIndex(index)}
              />
            ))}
          </div>
          <footer>
            <span>{adventureProductionProfiles.length} original families</span>
            <span>profile contract v{profile.profileVersion}</span>
          </footer>
        </aside>

        <section className="ppf-canvas">
          <header className="ppf-profile-heading">
            <div>
              <span className="ppf-eyebrow">SELECTED PRODUCTION LANGUAGE</span>
              <h1>{profile.label}</h1>
              <p>{profile.summary}</p>
            </div>
            <dl>
              <div>
                <dt>Canvas</dt>
                <dd>
                  {profile.nativeSize.width} × {profile.nativeSize.height}
                </dd>
              </div>
              <div>
                <dt>Palette</dt>
                <dd>{profile.palette.maxColours} colours</dd>
              </div>
              <div>
                <dt>Motion</dt>
                <dd>{profile.pixelMotionPolicy}</dd>
              </div>
              <div>
                <dt>Score</dt>
                <dd>{profile.interface.showScore ? "visible" : "hidden"}</dd>
              </div>
            </dl>
          </header>

          <div className="ppf-preview-grid">
            <SplashPreview profile={profile} />
            <InterfacePreview profile={profile} />
          </div>

          <section className="ppf-doctrine-grid">
            <article>
              <span className="ppf-eyebrow">SCENE DOCTRINE</span>
              <h2>{profile.scene.focalHierarchy}</h2>
              <p>{profile.scene.cameraDoctrine}</p>
              <p>{profile.scene.stageLane}</p>
            </article>
            <article>
              <span className="ppf-eyebrow">ACTOR PERFORMANCE</span>
              <h2>{profile.actors.silhouette}</h2>
              <p>{profile.actors.performanceDoctrine}</p>
              <small>
                Ordinary actor height {profile.actors.relativeHeightPercent[0]}–
                {profile.actors.relativeHeightPercent[1]}% of native frame
              </small>
            </article>
            <article>
              <span className="ppf-eyebrow">PUZZLE GRAMMAR</span>
              <div className="ppf-tag-list">
                {profile.puzzleGrammars.map((grammar) => (
                  <span key={grammar}>{grammar.replaceAll("-", " ")}</span>
                ))}
              </div>
              <p>{profile.showcase.logline}</p>
            </article>
          </section>

          <section className="ppf-showcase">
            <header>
              <div>
                <span className="ppf-eyebrow">ORIGINAL SHOWCASE VERTICAL SLICE</span>
                <h2>{profile.showcase.title}</h2>
                <p>{profile.showcase.genre}</p>
              </div>
              <code>{profile.showcase.id}</code>
            </header>
            <div className="ppf-showcase-scenes">
              {profile.showcase.sceneBriefs.map((scene, index) => (
                <article key={scene}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{scene}</p>
                </article>
              ))}
            </div>
            <div className="ppf-system-strip">
              {profile.showcase.featuredSystems.map((system) => (
                <span key={system}>{system}</span>
              ))}
            </div>
          </section>
        </section>

        <aside className="ppf-inspector">
          <section>
            <span className="ppf-eyebrow">CANONICAL SEED</span>
            <h2>{seed.presentation.interactionMode}</h2>
            <dl>
              <div>
                <dt>Production</dt>
                <dd>{seed.creativeDirection.productionMode}</dd>
              </div>
              <div>
                <dt>Composition</dt>
                <dd>{seed.creativeDirection.compositionMode}</dd>
              </div>
              <div>
                <dt>Sampling</dt>
                <dd>{seed.presentation.textureSampling}</dd>
              </div>
              <div>
                <dt>Scale</dt>
                <dd>{seed.presentation.integerScale ? "integer" : "fractional"}</dd>
              </div>
            </dl>
          </section>

          <RuleList title="AUTHENTICITY RULES" items={profile.authenticityRules} />
          <RuleList title="PROHIBITED SHORTCUTS" items={profile.prohibitedShortcuts} />
          <RuleList title="NATIVE REVIEW" items={profile.reviewQuestions} />

          <section className="ppf-audio-section">
            <span className="ppf-eyebrow">AUDIO IDENTITY</span>
            <h2>{profile.audio.transitionSting}</h2>
            <p>{profile.audio.music}</p>
            <p>{profile.audio.ambience}</p>
          </section>

          <section className="ppf-originality">
            <span className="ppf-eyebrow">ORIGINALITY BOUNDARY</span>
            <p>{profile.showcase.originalityStatement}</p>
          </section>

          <footer>
            <span>Profile {shortId(profile.id)}</span>
            <code>{report.issues.length} finding(s)</code>
          </footer>
        </aside>
      </div>
    </main>
  );
};
