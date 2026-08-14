import { createDefaultClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import { studioFontProject } from "./font-fixture.js";

const base = createDefaultClassicFrontEndManifest(studioFontProject.id);

export const studioFrontEndManifest = {
  ...base,
  credits: {
    lines: [
      "A CLASSIC ADVENTURE PRODUCTION",
      "RUNNING ON EVAVO ADVENTURE STUDIO",
      "DESIGNED FOR NATIVE 320 × 200 PRESENTATION",
    ],
  },
};

export { studioFontProject as studioFrontEndProject };