# Release validation and workflow capacity

## Current state

Adventure Studio has an exact source toolchain but no committed `pnpm-lock.yaml`.

```text
Node.js 24.18.0
pnpm 11.17.0
```

Dependency-free source readiness is available. Installed workspace, browser build and editor-expansion readiness remain blocked until a canonical shared workspace lock is generated, reviewed and committed.

A source-contract pass is not evidence that TypeScript, Vitest, Biome, Vite, Pixi, Sharp or any browser application executed.

## Capacity model

The repository previously ran two automatic workflows across Ubuntu and Windows, creating up to four hosted jobs for an ordinary source change. Both workflows also used a mutable installation.

The retained operating model is:

```text
develop locally
→ run source contracts
→ commit and push to main
→ no automatic workflow run
→ select one exact current main SHA
→ dispatch one deliberate operating-system lane
→ retain bounded evidence
→ dispatch the second operating system only when release evidence requires it
```

A single dispatch starts one runner, not an operating-system matrix.

## Source contracts

From a complete checkout:

```powershell
Set-Location C:\GitRepos\evavo-adventure-studio
corepack enable
corepack prepare pnpm@11.17.0 --activate
pnpm run source:check
```

This validates:

- `.node-version` and `.nvmrc` alignment;
- the active Node and pnpm versions;
- repository and workflow release policy;
- pinned workspace catalog declarations;
- the absence of `latest` and cross-repository `file:` dependencies.

It installs nothing, starts no browser application, calls no provider and deploys nothing.

## Canonical lock generation

Generate the shared workspace lock only from a clean exact-`main` checkout:

```powershell
node --version
pnpm --version
git status --short
pnpm install --lockfile-only
```

Required tool output:

```text
v24.18.0
11.17.0
```

Review the generated `pnpm-lock.yaml` before committing it. Confirm:

1. the root importer exists;
2. all `apps/*`, `packages/*` and `tools/*` projects are represented;
3. workspace dependencies remain governed by the repository workspace policy;
4. catalog versions resolve exactly as declared in `pnpm-workspace.yaml`;
5. no `latest`, cross-repository `file:`, local absolute path, registry credential or environment value appears;
6. no application source or generated artifact changed with the lock;
7. the lock was generated, not hand edited.

## Complete workspace proof

After committing the reviewed lock, start from a fresh checkout of that exact SHA:

```powershell
corepack enable
corepack prepare pnpm@11.17.0 --activate
node scripts/check-ci-release-readiness.mjs --full
pnpm install --frozen-lockfile
pnpm run check:ci
git diff --exit-code
git status --short
```

Run the complete workspace gate separately on:

```text
ubuntu-24.04
windows-2022
```

The two operating-system results may be dispatched independently. Do not restore an automatic matrix.

## Editor expansion proof

The canonical editor-expansion command is:

```powershell
pnpm run check:editor-expansion
```

It runs the exact shared sequence for both operating systems:

- toolchain verification;
- `tsconfig.editor-expansion.json` project compilation;
- the complete editor, runtime, player, studio, timeline and CLI test selection;
- player build;
- main visual studio build;
- timeline lab build;
- CLI build.

The workflow may run only after a frozen install from the committed lock.

## Workflow rules

Both workflows are manual exact-SHA gates. They require:

- `request_source=evavo-development-studio`;
- the requested SHA to equal the dispatched `main` SHA;
- proof that the candidate belongs to `origin/main`;
- one explicitly selected runner;
- immutable remote action commit SHAs;
- no persisted checkout credentials;
- read-only repository permissions;
- a clean tracked tree after validation;
- bounded evidence retention;
- no provider, release, package-publication or deployment authority.

## Prohibited shortcuts

Do not:

- restore push, pull-request or scheduled validation;
- restore the Ubuntu/Windows matrix;
- use `pnpm install --no-frozen-lockfile`;
- hand-edit `pnpm-lock.yaml`;
- treat source readiness as installed-runtime evidence;
- publish packages or deploy applications from CI validation;
- classify a zero-step GitHub Actions failure as a source defect.
