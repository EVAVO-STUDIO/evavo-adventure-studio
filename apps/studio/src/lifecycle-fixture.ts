import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  createDefaultFailureLifecycleMenu,
  parseGameLifecycleManifest,
} from "@evavo/adventure-project-schema/lifecycle";
import { studioProject } from "./fixture.js";

export const studioLifecycleProject = parseAdventureProject({
  ...studioProject,
  assets: [
    ...studioProject.assets,
    { id: "asset.item.red-ledger", path: "art/items/red-ledger.png", kind: "image" },
  ],
  inventoryItems: [
    {
      id: "item.red-ledger",
      name: "Red ledger",
      description: "The municipal ledger at the heart of the case.",
      iconAssetId: "asset.item.red-ledger",
    },
  ],
});

const failureMenu = createDefaultFailureLifecycleMenu();

export const studioLifecycleManifest = parseGameLifecycleManifest({
  manifestVersion: 1,
  projectId: studioLifecycleProject.id,
  outcomes: [
    {
      id: "outcome.case-closed",
      kind: "failure",
      priority: 100,
      when: { kind: "flag", flag: "case.failed", equals: true },
      title: "Case Closed",
      message: "The trail has gone cold. Mara can no longer finish the investigation.",
      menu: failureMenu,
    },
    {
      id: "outcome.arrested",
      kind: "failure",
      priority: 80,
      when: { kind: "variable", variable: "police-heat", operator: "gte", value: 5 },
      title: "Taken In",
      message: "Too many doors were kicked open. The night ends in an interview room.",
      menu: failureMenu,
    },
    {
      id: "outcome.ledger-proved",
      kind: "success",
      priority: 60,
      when: {
        kind: "all",
        conditions: [
          { kind: "flag", flag: "ledger.verified", equals: true },
          { kind: "has-item", itemId: "item.red-ledger" },
        ],
      },
      title: "The Ledger Speaks",
      message: "The impossible debt is proved. By morning, the harbour has a different story to tell.",
      menu: {
        ...failureMenu,
        allowQuickRetry: false,
      },
    },
  ],
});