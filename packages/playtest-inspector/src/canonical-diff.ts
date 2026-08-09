import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { loadSaveGame } from "@evavo/adventure-save-game";

export type CanonicalInspectorValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalInspectorValue[]
  | { readonly [key: string]: CanonicalInspectorValue };

export interface CanonicalSaveDifference {
  readonly kind: "added" | "removed" | "changed";
  readonly path: string;
  readonly before?: CanonicalInspectorValue;
  readonly after?: CanonicalInspectorValue;
}

export interface CanonicalSaveDiff {
  readonly comparisonVersion: 1;
  readonly changed: boolean;
  readonly truncated: boolean;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
  readonly entries: readonly CanonicalSaveDifference[];
}

export interface CanonicalSaveDiffOptions {
  readonly maxDifferences?: number;
}

const compareText = (left: string, right: string): number => left.localeCompare(right);

const canonicalValue = (value: unknown): CanonicalInspectorValue => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    return Object.fromEntries(
      Object.keys(source)
        .sort(compareText)
        .flatMap((key) => {
          const child = source[key];
          return child === undefined ? [] : [[key, canonicalValue(child)] as const];
        }),
    );
  }
  throw new TypeError(`Playtest state contains unsupported value type '${typeof value}'.`);
};

const isRecord = (
  value: CanonicalInspectorValue,
): value is Readonly<Record<string, CanonicalInspectorValue>> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const childPath = (path: string, key: string | number): string =>
  typeof key === "number" ? `${path}[${key}]` : path ? `${path}.${key}` : key;

export const diffCanonicalSaveGames = (
  bundle: RuntimeBundle,
  beforeInput: unknown,
  afterInput: unknown,
  options: CanonicalSaveDiffOptions = {},
): CanonicalSaveDiff => {
  const maxDifferences = options.maxDifferences ?? 500;
  if (!Number.isInteger(maxDifferences) || maxDifferences <= 0) {
    throw new RangeError("maxDifferences must be a positive integer.");
  }

  const beforeSave = loadSaveGame(bundle, beforeInput);
  const afterSave = loadSaveGame(bundle, afterInput);
  const before = canonicalValue({
    world: beforeSave.world,
    interface: beforeSave.interface,
  });
  const after = canonicalValue({
    world: afterSave.world,
    interface: afterSave.interface,
  });
  const entries: CanonicalSaveDifference[] = [];
  let truncated = false;

  const append = (entry: CanonicalSaveDifference): void => {
    if (entries.length >= maxDifferences) {
      truncated = true;
      return;
    }
    entries.push(entry);
  };

  const visit = (
    beforeValue: CanonicalInspectorValue,
    afterValue: CanonicalInspectorValue,
    path: string,
  ): void => {
    if (entries.length >= maxDifferences) {
      truncated = true;
      return;
    }
    if (Object.is(beforeValue, afterValue)) return;

    if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
      const length = Math.max(beforeValue.length, afterValue.length);
      for (let index = 0; index < length; index += 1) {
        if (index >= beforeValue.length) {
          append({
            kind: "added",
            path: childPath(path, index),
            after: afterValue[index] as CanonicalInspectorValue,
          });
        } else if (index >= afterValue.length) {
          append({
            kind: "removed",
            path: childPath(path, index),
            before: beforeValue[index] as CanonicalInspectorValue,
          });
        } else {
          visit(
            beforeValue[index] as CanonicalInspectorValue,
            afterValue[index] as CanonicalInspectorValue,
            childPath(path, index),
          );
        }
      }
      return;
    }

    if (isRecord(beforeValue) && isRecord(afterValue)) {
      const keys = [...new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)])].sort(compareText);
      for (const key of keys) {
        const hasBefore = Object.hasOwn(beforeValue, key);
        const hasAfter = Object.hasOwn(afterValue, key);
        if (!hasBefore) {
          append({
            kind: "added",
            path: childPath(path, key),
            after: afterValue[key] as CanonicalInspectorValue,
          });
        } else if (!hasAfter) {
          append({
            kind: "removed",
            path: childPath(path, key),
            before: beforeValue[key] as CanonicalInspectorValue,
          });
        } else {
          visit(
            beforeValue[key] as CanonicalInspectorValue,
            afterValue[key] as CanonicalInspectorValue,
            childPath(path, key),
          );
        }
      }
      return;
    }

    append({
      kind: "changed",
      path,
      before: beforeValue,
      after: afterValue,
    });
  };

  visit(before, after, "");
  return {
    comparisonVersion: 1,
    changed: entries.length > 0,
    truncated,
    beforeFingerprint: beforeSave.saveFingerprint,
    afterFingerprint: afterSave.saveFingerprint,
    entries,
  };
};
