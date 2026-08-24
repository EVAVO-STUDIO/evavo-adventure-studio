import {
  actors,
  animation,
  audio,
  interfaceGrammar,
  palette,
  profile,
  scene,
  showcase,
} from "./production-profile-factory.js";
import { productionProfileSplashes as splashes } from "./production-profile-splashes.js";
import type { AdventureProductionProfile } from "./production-profile-types.js";

export const socialComedyProductionProfiles: readonly AdventureProductionProfile[] = [
  profile({
    id: "social-comedy-icon-vga",
    label: "Social Comedy Icon VGA",
    family: "icon-social-comedy",
    summary:
      "Grounded early-SCI VGA social comedy with icon interaction, visible score, venue state, relationship consequences and tightly staged embarrassment/recovery beats.",
    productionModes: ["painted-pixel", "graphic-cel"],
    compositionModes: ["stage", "cinematic"],
    palette: palette(
      256,
      ["#0b0d16", "#263044", "#5c4c58", "#8b6558", "#c59a72", "#e8d8b4"],
      "Use believable nightlife/interior value groups with selective saturated accents; do not flatten every venue into neon purple or universal black outlines.",
      "Reserve warm skin, signage and practical-light ramps for social focus, while keeping props and exits readable at raw 320 by 200.",
      18,
    ),
    scene: scene(
      "Stage bars, hotels, apartments, streets, restaurants and service interiors as believable social spaces first and joke delivery systems second.",
      "Protect clear lower-middle movement while preserving believable tables, counters, doorways and social approach positions.",
      "Current social objective, conversational partner and consequential prop must read without a modern quest marker.",
      "Successful introductions, rejection, disguise, payment, access and embarrassment should visibly alter people, props or venue access when appropriate.",
    ),
    actors: actors(
      "Grounded adult silhouettes, readable clothing and posture, expressive hands and face clusters without caricature swallowing the room scale.",
      [24, 41],
      "Occasional close conversation portraits support important reactions, while ordinary dialogue remains readable in scene.",
      "Reaction holds, awkward pauses, confidence changes and prop handling carry comedy more than constant animation.",
    ),
    animation: animation(
      "Economical six-to-eight-frame walks with deliberate greeting, offer, drink, inspect, recoil and embarrassment poses.",
      [6, 8],
      "Short social business loops may reveal availability or mood but must not distract from puzzle state.",
      "Use authored anticipation and held reaction timing for jokes; avoid modern easing-heavy character animation.",
    ),
    interface: interfaceGrammar(
      "top-icon-bar",
      "icon-bar",
      ["icon-bar", "context"],
      0,
      false,
      "floating-subtitle",
      "Inventory is compact and object-led, supporting gifts, money, disguise pieces, keys and situational props.",
      "Short narration, social feedback and score remain explicit without a relationship meter or modern objective log.",
      "Walk, look, use, talk and inventory intents stay distinct; conversation state is communicated through authored response and availability.",
      true,
    ),
    puzzleGrammars: ["relationship-branch", "inventory-chain", "comic-misapplication", "environmental-state"],
    audio: audio(
      "Venue-specific MIDI/digital motifs with restrained lounge, street and interior colour rather than generic comedy scoring.",
      "Crowd murmur, traffic, doors, glasses, telephones and room tone establish social place beneath dialogue.",
      "Brief stings mark discovery, rejection, access and comic reversal without turning every joke into a sound effect.",
      "Inventory, cash, door and practical object sounds stay short, dry and physical.",
    ),
    splash: splashes.pulp,
    showcase: showcase(
      "showcase.after-hours",
      "After Hours",
      "social comedy adventure",
      "A stranded convention photographer has one night to recover a misplaced portfolio while every helpful lead comes with an awkward social cost.",
      [
        "A hotel lounge with readable social groups, a guarded service door and several reversible conversational mistakes.",
        "A late restaurant where payment, disguise and one misplaced coat create multiple social solutions.",
        "A penthouse corridor where prior impressions, inventory choices and timing determine access without a modern relationship HUD.",
      ],
      ["icon interaction", "social state", "score", "relationship branches", "timed reactions", "recoverable embarrassment"],
    ),
    rule: "Comedy must arise from authored character, timing and consequence while every puzzle remains mechanically legible.",
    prohibition: "Do not substitute cruelty, sexual coercion, meme references, generic dating-sim meters or modern mobile-style relationship UI for period social-adventure design.",
    reviewQuestions: [
      "Can the player understand social consequence from dialogue, pose and room state without a relationship meter?",
      "Do venues read as believable 1990s adventure locations rather than neon parody sets?",
      "Are failed social approaches specific, funny and recoverable without random humiliation loops?",
    ],
  }),
] as const;
