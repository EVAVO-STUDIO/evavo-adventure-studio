import { coldMeridianShowcase } from "./production-showcase-cold-meridian.js";
import { glassFinchShowcase } from "./production-showcase-glass-finch.js";
import { hollowValeShowcase } from "./production-showcase-hollow-vale.js";
import { jadeHorizonShowcase } from "./production-showcase-jade-horizon.js";
import { nightShiftShowcase } from "./production-showcase-night-shift.js";
import { openCaseShowcase } from "./production-showcase-open-case.js";
import { redLedgerShowcase } from "./production-showcase-red-ledger.js";
import { saltwakeIslandShowcase } from "./production-showcase-saltwake-island.js";
import { sunkenDialShowcase } from "./production-showcase-sunken-dial.js";
import type { AdventureProductionShowcase } from "./production-showcase-types.js";
import { vacuumCourtesyShowcase } from "./production-showcase-vacuum-courtesy.js";

export const adventureProductionShowcases: readonly AdventureProductionShowcase[] = [
  glassFinchShowcase,
  vacuumCourtesyShowcase,
  redLedgerShowcase,
  hollowValeShowcase,
  nightShiftShowcase,
  openCaseShowcase,
  saltwakeIslandShowcase,
  sunkenDialShowcase,
  jadeHorizonShowcase,
  coldMeridianShowcase,
];
