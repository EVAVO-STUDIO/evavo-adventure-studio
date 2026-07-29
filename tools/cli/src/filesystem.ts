import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import {
  basename,
  dirname,
  join,
  parse,
  resolve,
} from "node:path";
import {
  portablePathKey,
  portableRelativePathError,
} from "@evavo/adventure-asset-contract/portable-path";

export interface AtomicFileWrite {
  readonly path: string;
  readonly data: string | Uint8Array;
}

export interface AtomicDirectoryFile {
  readonly relativePath: string;
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

export const pathExists = async (path: string): Promise<boolean> => {
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

const duplicateAbsolutePathKey = (path: string): string =>
  process.platform === "win32" ? path.toLocaleLowerCase("en-US") : path;

const writeFlushedFile = async (
  path: string,
  data: string | Uint8Array,
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, "wx");
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
};

const stageFile = async (
  targetPath: string,
  data: string | Uint8Array,
  token: string,
  index: number,
): Promise<StagedWrite> => {
  const temporaryPath = `${targetPath}.tmp-${token}-${index}`;
  const backupPath = `${targetPath}.bak-${token}-${index}`;
  await writeFlushedFile(temporaryPath, data);

  return {
    targetPath,
    temporaryPath,
    backupPath,
    hadExistingTarget: false,
    committed: false,
  };
};

const rollbackFiles = async (writes: readonly StagedWrite[]): Promise<void> => {
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
    const key = duplicateAbsolutePathKey(file.path);
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
    await rollbackFiles(staged);
    throw error;
  }
};

export const assertSafeRelativePath = (relativePath: string): string => {
  const pathError = portableRelativePathError(relativePath);
  if (pathError) {
    throw new RangeError(
      `Release path '${relativePath}' is not portable: ${pathError}`,
    );
  }
  return relativePath;
};

export const replaceDirectoryAtomically = async (
  targetDirectory: string,
  files: readonly AtomicDirectoryFile[],
): Promise<string> => {
  const targetPath = resolve(targetDirectory);
  if (targetPath === parse(targetPath).root) {
    throw new RangeError("A filesystem root cannot be used as a release directory.");
  }

  const seen = new Set<string>();
  const normalizedFiles = files.map((file) => {
    const relativePath = assertSafeRelativePath(file.relativePath);
    const key = portablePathKey(relativePath);
    if (seen.has(key)) {
      throw new RangeError(
        `Release path '${relativePath}' collides with another release file.`,
      );
    }
    seen.add(key);
    return { relativePath, data: file.data };
  });

  const token = `${process.pid}-${randomUUID()}`;
  const parent = dirname(targetPath);
  const name = basename(targetPath);
  const temporaryPath = join(parent, `${name}.tmp-${token}`);
  const backupPath = join(parent, `${name}.bak-${token}`);
  let hadExistingTarget = false;
  let committed = false;

  await mkdir(parent, { recursive: true });
  await mkdir(temporaryPath);
  try {
    for (const file of normalizedFiles) {
      const destination = join(temporaryPath, ...file.relativePath.split("/"));
      await writeFlushedFile(destination, file.data);
    }

    hadExistingTarget = await pathExists(targetPath);
    if (hadExistingTarget) {
      await rename(targetPath, backupPath);
    }
    await rename(temporaryPath, targetPath);
    committed = true;
    await rm(backupPath, { recursive: true, force: true });
    return targetPath;
  } catch (error) {
    if (committed) {
      await rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
    }
    if (hadExistingTarget && (await pathExists(backupPath))) {
      await rename(backupPath, targetPath).catch(() => undefined);
    }
    await rm(temporaryPath, { recursive: true, force: true }).catch(
      () => undefined,
    );
    await rm(backupPath, { recursive: true, force: true }).catch(
      () => undefined,
    );
    throw error;
  }
};

export const withTrailingNewline = (value: string): string =>
  value.endsWith("\n") ? value : `${value}\n`;
