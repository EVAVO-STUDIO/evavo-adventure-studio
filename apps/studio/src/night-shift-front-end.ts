import { classicFrontEndManifestSchema } from "@evavo/adventure-project-schema/front-end";
import { nightShiftCompleteProject } from "./night-shift-complete-proof.js";

export const nightShiftFrontEnd = classicFrontEndManifestSchema.parse({
  manifestVersion: 1,
  projectId: nightShiftCompleteProject.id,
  publisher: {
    name: "EVAVO",
    presents: "ADVENTURE STUDIO PRESENTS",
    splashDurationTicks: 84,
    splashSkipAfterTicks: 18,
  },
  title: {
    kicker: "A MUNICIPAL NIGHT-DUTY ADVENTURE",
  },
  menu: {
    labels: {
      newGame: "START NIGHT SHIFT",
      continueGame: "CONTINUE SHIFT",
      loadGame: "LOAD A SAVE",
      options: "OPTIONS",
      credits: "CREDITS",
      quit: "QUIT",
      quickSave: "QUICK SAVE",
      back: "BACK",
      fullscreen: "TOGGLE FULLSCREEN",
    },
    showContinue: true,
    showLoad: true,
    showOptions: true,
    showCredits: true,
    showQuit: true,
  },
  options: {
    allowFullscreen: true,
  },
  credits: {
    lines: [
      "AN ORIGINAL EVAVO ADVENTURE",
      "BUILT WITH EVAVO ADVENTURE STUDIO",
      "EARLY PROCEDURAL ICON VGA PROOF",
    ],
  },
});
