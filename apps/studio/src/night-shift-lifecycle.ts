import { parseGameLifecycleManifest } from "@evavo/adventure-project-schema/lifecycle";
import { nightShiftCompleteProject } from "./night-shift-complete-proof.js";

export const nightShiftLifecycle = parseGameLifecycleManifest({
  manifestVersion: 1,
  projectId: nightShiftCompleteProject.id,
  outcomes: [
    {
      id: "outcome.night-shift.roadside-failure",
      kind: "failure",
      priority: 200,
      when: {
        kind: "flag",
        flag: "roadsideFailure",
        equals: true,
      },
      title: "BAD STOP",
      message:
        "YOU MOVED BEFORE YOU HAD READ THE CAR AND DRIVER. THE ROUTINE STOP TURNED NEEDLESSLY DANGEROUS.",
      menu: {
        allowQuickRetry: true,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
        labels: {
          quickRetry: "RETRY THE STOP",
          loadGame: "LOAD A SAVE",
          restartGame: "RESTART NIGHT SHIFT",
          returnToTitle: "RETURN TO TITLE",
          back: "BACK",
        },
      },
    },
    {
      id: "outcome.night-shift.proof-complete",
      kind: "success",
      priority: 100,
      when: {
        kind: "flag",
        flag: "nightShiftProofComplete",
        equals: true,
      },
      title: "SHIFT NOTE COMPLETE",
      message:
        "THE STOP STAYED ROUTINE. THE DINER GAVE YOU ONE USEFUL OBSERVATION AND ONE PHYSICAL CORROBORATION.",
      menu: {
        allowQuickRetry: false,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
        labels: {
          quickRetry: "QUICK RETRY",
          loadGame: "LOAD A SAVE",
          restartGame: "RESTART NIGHT SHIFT",
          returnToTitle: "RETURN TO TITLE",
          back: "BACK",
        },
      },
    },
  ],
});
