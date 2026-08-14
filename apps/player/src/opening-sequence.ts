import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";

export const openingSequenceSkipped = (search: string): boolean => {
  const value = new URLSearchParams(search).get("opening");
  return value === "skip" || value === "off" || value === "0";
};

export const configuredOpeningSequenceId = (
  bundle: Pick<RuntimeBundle, "opening">,
  search: string,
): Id<"sequence"> | null =>
  openingSequenceSkipped(search) ? null : (bundle.opening?.newGameSequenceId ?? null);

export const requestedNewGameOpeningSequenceId = (
  bundle: Pick<RuntimeBundle, "opening">,
  search: string,
  restoringSave: boolean,
): Id<"sequence"> | null =>
  restoringSave ? null : configuredOpeningSequenceId(bundle, search);

export const frameWithoutInteractiveChrome = (frame: ResolvedFrame): ResolvedFrame => ({
  ...frame,
  nodes: frame.nodes.filter(
    (node) => node.order.layer !== "interface" && node.order.layer !== "cursor",
  ),
});
