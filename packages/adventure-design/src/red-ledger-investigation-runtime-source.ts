import { RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID } from "./red-ledger-runtime.js";
import {
  redLedgerInvestigationProof,
} from "./red-ledger-investigation-proof.js";
import type { InvestigationManifest } from "./investigation-kernel.js";

export interface RedLedgerRuntimeInvestigationSource extends InvestigationManifest {
  readonly projectId: typeof RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID;
}

export const redLedgerRuntimeInvestigationSource: RedLedgerRuntimeInvestigationSource = {
  ...redLedgerInvestigationProof,
  projectId: RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID,
};
