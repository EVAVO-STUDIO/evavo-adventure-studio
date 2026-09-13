export const MAXIMUM_REPLAY_BUNDLE_BYTES = 64 * 1024 * 1024;
export const MAXIMUM_REPLAY_FILE_BYTES = 32 * 1024 * 1024;

export class ReplayInputFileTooLargeError extends Error {
  readonly path: string;
  readonly actualBytes: number;
  readonly maximumBytes: number;

  constructor(path: string, actualBytes: number, maximumBytes: number) {
    super(`Input '${path}' is ${actualBytes} byte(s); the maximum is ${maximumBytes}.`);
    this.name = "ReplayInputFileTooLargeError";
    this.path = path;
    this.actualBytes = actualBytes;
    this.maximumBytes = maximumBytes;
  }
}

export const assertReplayInputFileSize = (path: string, actualBytes: number, maximumBytes: number): void => {
  if (!Number.isSafeInteger(actualBytes) || actualBytes < 0) {
    throw new RangeError("actualBytes must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new RangeError("maximumBytes must be a positive safe integer.");
  }
  if (actualBytes > maximumBytes) {
    throw new ReplayInputFileTooLargeError(path, actualBytes, maximumBytes);
  }
};
