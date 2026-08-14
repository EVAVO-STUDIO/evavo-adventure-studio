import type { GameLifecycleManifest } from "@evavo/adventure-project-schema/lifecycle";
import {
  lifecycleLocalisationKey,
  lifecycleMenuLabelKeys,
} from "@evavo/adventure-project-schema/localisation";

export type LifecycleTextResolver = (key: string, sourceText: string) => string;

export const localiseGameLifecycleManifest = (
  manifest: GameLifecycleManifest,
  resolve: LifecycleTextResolver,
): GameLifecycleManifest => ({
  ...manifest,
  outcomes: manifest.outcomes.map((outcome) => {
    const labels = { ...outcome.menu.labels };
    for (const label of lifecycleMenuLabelKeys) {
      labels[label] = resolve(
        lifecycleLocalisationKey(outcome.id, `menu.${label}`),
        outcome.menu.labels[label],
      );
    }
    return {
      ...outcome,
      title: resolve(lifecycleLocalisationKey(outcome.id, "title"), outcome.title),
      message: resolve(lifecycleLocalisationKey(outcome.id, "message"), outcome.message),
      menu: {
        ...outcome.menu,
        labels,
      },
    };
  }),
});
