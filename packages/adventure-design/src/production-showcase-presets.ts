import type { AdventureProductionShowcase } from "./production-showcase-types.js";
import { coldMeridianShowcase } from "./production-showcase-cold-meridian.js";
import { glassFinchShowcase } from "./production-showcase-glass-finch.js";
import { jadeHorizonShowcase } from "./production-showcase-jade-horizon.js";
import { redLedgerShowcase } from "./production-showcase-red-ledger.js";
import { saltwakeIslandShowcase } from "./production-showcase-saltwake-island.js";
import { sunkenDialShowcase } from "./production-showcase-sunken-dial.js";
import { vacuumCourtesyShowcase } from "./production-showcase-vacuum-courtesy.js";

export const adventureProductionShowcases: readonly AdventureProductionShowcase[] = [
  glassFinchShowcase,
  vacuumCourtesyShowcase,
  redLedgerShowcase,
  saltwakeIslandShowcase,
  sunkenDialShowcase,
  jadeHorizonShowcase,
  coldMeridianShowcase,
];
