export const PLAYER_RUNTIME_RESTORED_EVENT = "evavo-adventure-runtime-restored";

export interface PlayerRuntimeRestoredDetail {
  readonly restoredTick: number;
  readonly tickOffset: number;
}

export const canonicalRuntimeTickFromPlayerTick = (
  playerTick: number,
  tickOffset: number,
): number => {
  const tick = playerTick - tickOffset;
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError("Mapped replay tick must be a non-negative safe integer.");
  }
  return tick;
};