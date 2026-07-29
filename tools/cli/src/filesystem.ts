import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface AtomicFileWrite {
  readonly path: string;
  readonly data: string | Uint8Array;
}

interface StagedWrite {
  readonly targetPath: string;
  readonly temporaryPath: string;
  readonly backupPath: string;
  hadExistingTarget: boolean;
  committed: boolean;
}

const isMissingPathError = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException | null)?.code === "ENOENT";

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
};

const duplicateKey = (path: string): string =>
  process.platform === "win32" ? path.toLocaleLowerCase("en-US") : path;

const stageFile = async (
  targetPath: string,
  data: string | Uint8Array,
  token: string,
  index: number,
): Promise<StagedWrite> => {
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${token}-${index}`;
  const backupPath = `${targetPath}.bak-${token}-${index}`;
  const handle = await open(temporaryPath, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }

  return {
    targetPath,
    temporaryPath,
    backupPath,
    hadExistingTarget: false,
    committed: false,
  };
};

const rollback = async (writes: readonly StagedWrite[]): Promise<void> => {
  for (const write of [...writes].reverse()) {
    if (write.committed) {
      await rm(write.targetPath, { force: true }).catch(() => undefined);
    }
    if (write.hadExistingTarget && (await pathExists(write.backupPath))) {
      await rename(write.backupPath, write.targetPath).catch(() => undefined);
    }
    await rm(write.temporaryPath, { force: true }).catch(() => undefined);
    await rm(write.backupPath, { force: true }).catch(() => undefined);
  }
};

export const writeFilesAtomically = async (
  files: readonly AtomicFileWrite[],
): Promise<readonly string[]> => {
  if (files.length === 0) {
    return [];
  }

  const resolvedFiles = files.map((file) => ({
    path: resolve(file.path),
    data: file.data,
  }));
  const seen = new Set<string>();
  for (const file of resolvedFiles) {
    const key = duplicateKey(file.path);
    if (seen.has(key)) {
      throw new RangeError(`Atomic write target '${file.path}' is duplicated.`);
    }
    seen.add(key);
  }

  const token = `${process.pid}-${randomUUID()}`;
  const staged: StagedWrite[] = [];
  try {
    for (let index = 0; index < resolvedFiles.length; index += 1) {
      const file = resolvedFiles[index];
      if (!file) {
        continue;
      }
      staged.push(await stageFile(file.path, file.data, token, index));
    }

    for (const write of staged) {
      write.hadExistingTarget = await pathExists(write.targetPath);
      if (write.hadExistingTarget) {
        await rename(write.targetPath, write.backupPath);
      }
      await rename(write.temporaryPath, write.targetPath);
      write.committed = true;
    }

    for (const write of staged) {
      await rm(write.backupPath, { force: true });
    }

    return staged.map((write) => write.targetPath);
  } catch (error) {
    await rollback(staged);
    throw error;
  }
};

export const withTrailingNewline = (value: string): string =>
  value.endsWith("\n") ? value : `${value}\n`;
