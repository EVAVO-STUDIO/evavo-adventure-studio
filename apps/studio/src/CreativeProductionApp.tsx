import {
  ninthReliquaryGameplayProof,
  ninthReliquaryProductionBlueprint,
  ninthReliquaryProductionProfile,
} from "@evavo/adventure-design/creative-production";
import "./creative-production.css";

const short = (value: string): string => value.split(".").at(-1) ?? value;

const studioLabel = (value: "art-studio" | "cel-animation-studio"): string =>
  value === "art-studio" ? "Art Studio" : "Cel Animation Studio";

export const CreativeProductionApp = () => {
  const blueprint = ninthReliquaryProductionBlueprint();
  const profile = ninthReliquaryProductionProfile();
  const proof = ninthReliquaryGameplayProof;
  const artOrders = blueprint.workOrderPlan.filter((order) => order.destinationStudio === "art-studio");
  const celOrders = blueprint.workOrderPlan.filter(
    (order) => order.destinationStudio === "cel-animation-studio",
  );

  return (
    <main className="creative-production-app">
      <header className="creative-production-hero">
        <div>
          <span className="creative-production-kicker">EVAVO ADVENTURE STUDIO · CREATIVE PRODUCTION</span>
          <h1>{proof.title}</h1>
          <p>{proof.premise}</p>
        </div>
        <div className="creative-production-profile-card">
          <span>PRODUCTION PROFILE</span>
          <strong>{profile.label}</strong>
          <small>
            {profile.nativeSize.width} × {profile.nativeSize.height} · {profile.palette.maxColours} colour budget
          </small>
        </div>
      </header>

      <section className="creative-production-status-strip" aria-label="Creative production status">
        <div>
          <span>Authority</span>
          <strong className="is-blocked">BLOCKED UNTIL APPROVED DIGESTS</strong>
        </div>
        <div>
          <span>Art Studio orders</span>
          <strong>{artOrders.length}</strong>
        </div>
        <div>
          <span>Cel Animation orders</span>
          <strong>{celOrders.length}</strong>
        </div>
        <div>
          <span>Whole-game stress scenes</span>
          <strong>{proof.scenes.length}</strong>
        </div>
      </section>

      <div className="creative-production-grid">
        <section className="creative-production-panel creative-production-authority">
          <div className="creative-production-panel-heading">
            <span>01</span>
            <div>
              <h2>Authority prerequisites</h2>
              <p>Final work orders are not emitted until these real approved authorities exist.</p>
            </div>
          </div>
          <div className="creative-production-list">
            {blueprint.authorityRequirements.map((requirement) => (
              <article key={requirement.id}>
                <div>
                  <strong>{requirement.id.replaceAll("-", " ").toUpperCase()}</strong>
                  <span>{requirement.owner.replaceAll("-", " ")}</span>
                </div>
                <p>{requirement.requiredState}</p>
                <small>{requirement.purpose}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="creative-production-panel">
          <div className="creative-production-panel-heading">
            <span>02</span>
            <div>
              <h2>Cross-studio work orders</h2>
              <p>Adventure Studio owns intent and acceptance. Art/Cel own production evidence.</p>
            </div>
          </div>
          <div className="creative-production-orders">
            {blueprint.workOrderPlan.map((order) => (
              <article key={order.workOrderId} className={`is-${order.destinationStudio}`}>
                <header>
                  <span>{studioLabel(order.destinationStudio)}</span>
                  <strong>{order.taskKind.replaceAll("-", " ")}</strong>
                </header>
                <code>{order.assetId}</code>
                <ul>
                  <li>{order.requiresTransparentAlpha ? "Real alpha + hostile plate proof required" : "Opaque master"}</li>
                  <li>{order.requiresModelSheet ? "Approved model-sheet authority required" : "No model-sheet dependency"}</li>
                  <li>{order.requiresXSheet ? "Approved X-sheet timing required" : "No X-sheet dependency"}</li>
                </ul>
                <footer>PLANNED · AWAITING AUTHORITY</footer>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="creative-production-panel creative-production-doctrine">
        <div className="creative-production-panel-heading">
          <span>03</span>
          <div>
            <h2>Admission doctrine</h2>
            <p>Returned files are candidates, never approvals.</p>
          </div>
        </div>
        <div className="creative-production-doctrine-grid">
          <article>
            <h3>Transparency</h3>
            <p>Checkerboard pixels are always rejected. Transparent assets require decoded alpha, transparent canvas edges, alpha-mask review and hostile solid-plate proofs.</p>
          </article>
          <article>
            <h3>Animation</h3>
            <p>Model sheet + X-sheet are authorities. Frames are reviewed against immediate neighbours, timing and anchors. Independently regenerating every exposed frame is a blocking error.</p>
          </article>
          <article>
            <h3>Iteration</h3>
            <p>Failed candidates produce targeted rework. Approved silhouette, perspective, colour or construction can be frozen while only the failed dimensions are revised.</p>
          </article>
          <article>
            <h3>Acceptance</h3>
            <p>Compilation admission records bind the exact candidate digest, source digest, work order, studio and visual-standard digest that passed review.</p>
          </article>
        </div>
      </section>

      <section className="creative-production-panel">
        <div className="creative-production-panel-heading">
          <span>04</span>
          <div>
            <h2>Whole-game stress proof</h2>
            <p>This lane must prove a complete cinematic adventure grammar, not one attractive screen.</p>
          </div>
        </div>
        <div className="creative-production-scenes">
          {proof.acts.map((act) => (
            <section key={act.act}>
              <header>
                <span>ACT {act.act}</span>
                <h3>{act.title}</h3>
                <p>{act.objective}</p>
              </header>
              {act.sceneIds.map((sceneId) => {
                const scene = proof.scenes.find((candidate) => candidate.id === sceneId);
                if (!scene) return null;
                return (
                  <article key={scene.id}>
                    <div className="creative-production-scene-title">
                      <span>{scene.archetype.replaceAll("-", " ")}</span>
                      <strong>{scene.title}</strong>
                    </div>
                    <p>{scene.purpose}</p>
                    <div className="creative-production-tags">
                      {scene.requiredCapabilities.slice(0, 6).map((capability) => (
                        <span key={capability}>{capability}</span>
                      ))}
                    </div>
                    <small>{scene.acceptanceQuestions[0]}</small>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      </section>

      <section className="creative-production-panel creative-production-command">
        <div>
          <span>REPRODUCIBLE EXPORT</span>
          <strong>pnpm export:ninth-reliquary-production [out-dir] [authorities.json]</strong>
        </div>
        <p>
          Without authorities, export produces the blueprint/profile/gameplay proof plus an authority-required manifest. Final Art/Cel work orders appear only after approved authority digests are supplied.
        </p>
      </section>

      <footer className="creative-production-footer">
        <span>Original proof · protected references used only for production principles</span>
        <code>{short(profile.showcase.id)}</code>
      </footer>
    </main>
  );
};
