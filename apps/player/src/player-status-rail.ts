export interface PlayerStatusRailOptions {
  readonly now?: () => number;
  readonly defaultHoldMilliseconds?: number;
}

export interface PlayerStatusRail {
  replace(text: string): void;
  announce(text: string, holdMilliseconds?: number): void;
  refresh(text: string): void;
  release(): void;
  current(): string | null;
  isHeld(): boolean;
}

const validHoldMilliseconds = (value: number, label: string): number => {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number.`);
  }
  return value;
};

export const createPlayerStatusRail = (
  write: (text: string) => void,
  options: PlayerStatusRailOptions = {},
): PlayerStatusRail => {
  const now = options.now ?? (() => performance.now());
  const defaultHoldMilliseconds = validHoldMilliseconds(
    options.defaultHoldMilliseconds ?? 1800,
    "Player status hold duration",
  );
  let currentText: string | null = null;
  let heldUntil = Number.NEGATIVE_INFINITY;

  const writeChanged = (text: string): void => {
    if (text === currentText) return;
    currentText = text;
    write(text);
  };

  const release = (): void => {
    heldUntil = Number.NEGATIVE_INFINITY;
  };

  return {
    replace: (text) => {
      release();
      writeChanged(text);
    },
    announce: (text, holdMilliseconds = defaultHoldMilliseconds) => {
      const duration = validHoldMilliseconds(
        holdMilliseconds,
        "Player status announcement duration",
      );
      heldUntil = Math.max(heldUntil, now() + duration);
      writeChanged(text);
    },
    refresh: (text) => {
      if (now() < heldUntil) return;
      release();
      writeChanged(text);
    },
    release,
    current: () => currentText,
    isHeld: () => now() < heldUntil,
  };
};
