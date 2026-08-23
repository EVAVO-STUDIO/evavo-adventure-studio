# Period VGA production audit

Adventure Studio does not treat `320 × 200`, nearest-neighbour scaling or a 256-colour limit as sufficient proof of 1990s authenticity.

A modern pixel-art frame can satisfy those technical limits and still look completely wrong for a professional Sierra/Dynamix-era adventure. The period VGA audit therefore combines **compiled pixel evidence** with **retained native art-direction review**.

Public API:

```ts
@evavo/adventure-art-direction/period-vga-audit
```

## Release question

The final review question is deliberately simple:

> Could this exact native frame plausibly have shipped from a professional 1990–1994 VGA adventure-game art department?

The answer is based on the actual final encoded asset, not the source PSD, prompt, high-resolution concept, browser preview or CRT simulation.

## Automatic evidence gates

The audit consumes the existing `ArtVisualEvidenceManifest` generated from compiled PNG outputs.

For each visual asset it verifies:

- final output is indexed rather than RGBA;
- colour count does not exceed 256;
- soft/full alpha is absent;
- background assets are fully opaque;
- the retained review refers to the exact compiled asset ID.

These are objective gates. They are not replaced by visual taste or screenshots.

## Native art-director review

Every asset admitted to a period-VGA proof also retains an explicit `PeriodVgaNativeReview`.

The reviewer must confirm:

1. **1× native review** — raw source pixels were inspected at their actual encoded resolution;
2. **integer presentation review** — nearest-neighbour display scaling was checked separately;
3. **period plausibility** — the result reads as deliberate professional VGA production rather than current indie pixel art;
4. **cluster discipline** — large value groups and meaningful clusters survive before microdetail;
5. **outline discipline** — material and depth are not flattened by one universal dark outline;
6. **dither discipline** — dithering describes material/value transitions and is not applied indiscriminately;
7. **modern effects absent** — no bloom, chromatic aberration, fractional blur, soft glow, motion blur or baked CRT treatment is required to make the frame work;
8. **synthetic microtexture absent** — no isolated-pixel noise, AI-like pseudo-detail, over-sharpened edge chatter or downsample residue remains.

A missing review blocks the period-VGA gate. This is intentional. Subjective production judgment should be visible and attributable rather than hidden behind an invented numeric image score.

## Profile-specific interpretation

The same gate is interpreted through the selected production profile.

### Storybook Icon VGA

Prefer broad painterly masses, irregular handmade architecture and foliage, atmospheric depth, small clear actor silhouettes and selective texture. Do not turn illustrated VGA painting into chunky modern pixel art.

### Early Procedural Icon VGA

Prefer believable eye-level municipal interiors, streets, diners and roadside locations; small proportionate figures; simple practical light; restrained materials and native interaction clarity. Do not import later case-management UI or modern police-simulator presentation.

### Gothic Investigation VGA

Prefer dense but readable interiors, coloured darkness, material differentiation, old furniture/paper/frames/ornaments, local warm practical light and expressive authored portrait/in-scene performance. Darkness must not erase interaction readability.

### Cinematic Pulp VGA / DGDS

Prefer large foreground forms, aggressive cinematic framing, held shots, bold negative space, hard editorial cuts and selective animation. City lights remain clustered pixels rather than bloom fields.

## Reject list

The following are automatic review failures unless a profile explicitly documents a rare exception:

- universal one-pixel outlines around every object;
- one-pixel texture sprinkled uniformly across surfaces;
- dithering across all gradients regardless of material;
- excessive saturation used as a substitute for value hierarchy;
- perfect smooth gradients that rely on later quantisation;
- bloom, lens flare, chromatic aberration or motion blur;
- baked CRT scanlines used to hide weak native pixels;
- artificially huge pixels or low-detail block art unrelated to the target production language;
- anti-aliased interface text or vector-clean curves in a native bitmap UI;
- soft sprite alpha and haloed cutout edges;
- modern concept-art camera language where the target profile calls for a readable adventure stage;
- AI-like microtexture, pseudo-lettering, edge wobble or inconsistent object detail;
- downsampled high-resolution art that was never corrected at 1× native scale.

## Review sizes

Every final gameplay frame or critical asset should be reviewed at:

- raw 1× native pixels;
- 2× nearest-neighbour;
- 3× nearest-neighbour;
- 4× nearest-neighbour;
- intended DOS 4:3 display presentation when pixel aspect requires it.

The raw 1× image remains the source of truth. Display treatment must never repair unreadable native composition.

## Suggested release workflow

1. compile the exact project assets;
2. generate `ArtVisualEvidenceManifest` from the compiled PNGs;
3. perform the 1× and integer-scale art review;
4. retain one `PeriodVgaNativeReview` per admitted visual asset;
5. run `auditPeriodVgaProduction`;
6. resolve all blocking issues;
7. recompile after any pixel change and repeat the review against the new output;
8. retain screenshots/video only as supplementary evidence, never as a substitute for the compiled pixel record.

This audit complements production-profile, Scene Director, interaction, playtest and reference-fidelity validation. It does not replace them.
