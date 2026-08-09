import type { Id } from "@evavo/adventure-project-schema";

export const fixtureId = <T extends string>(value: string): Id<T> => value as Id<T>;

export const fixtureSha256 = (digit = "0"): string => {
  if (!/^[0-9a-f]$/.test(digit)) {
    throw new RangeError("Fixture SHA-256 digit must be lowercase hexadecimal.");
  }
  return digit.repeat(64);
};
