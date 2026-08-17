param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{40}$')]
  [string]$BaseSha,

  [Parameter(Mandatory = $true)]
  [string]$CandidateRoot,

  [Parameter(Mandatory = $true)]
  [string]$RunnerLabel
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,

    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host "::group::$Label"
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) {
      throw "$Label failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Write-Host "::endgroup::"
  }
}

$repositoryRoot = (Get-Location).Path
$expectedSource = Join-Path $repositoryRoot ".github/dynamix-expected-paths.txt"
$payloadSource = Join-Path $repositoryRoot ".github/dynamix-recovery-payload.tar.gz"
$expectedCopy = Join-Path $env:RUNNER_TEMP "dynamix-expected-paths.txt"

if (-not (Test-Path -LiteralPath $expectedSource -PathType Leaf)) {
  throw "Expected-path manifest is missing."
}
if (-not (Test-Path -LiteralPath $payloadSource -PathType Leaf)) {
  throw "Recovery payload is missing."
}
if ((git rev-parse HEAD).Trim() -ne $env:GITHUB_SHA) {
  throw "Checked-out branch commit does not match GITHUB_SHA."
}
Invoke-Checked "Verify immutable base commit" {
  git cat-file -e "$BaseSha^{commit}"
}

Copy-Item -LiteralPath $expectedSource -Destination $expectedCopy -Force
Copy-Item -LiteralPath "apps/player/src/main.ts" -Destination "apps/player/src/runtime-main.ts" -Force
Invoke-Checked "Extract exact recovered source payload" {
  tar -xzf $payloadSource
}

$temporaryPaths = @(
  ".github/workflows/dynamix-recovery-validation.yml",
  ".github/dynamix-expected-paths.txt",
  ".github/dynamix-prepare-candidate.ps1",
  ".github/dynamix-recovery-payload.tar.gz"
)
foreach ($temporaryPath in $temporaryPaths) {
  if (Test-Path -LiteralPath $temporaryPath) {
    Remove-Item -LiteralPath $temporaryPath -Force
  }
}

$expectedPaths = @(
  Get-Content -LiteralPath $expectedCopy |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" }
)
if ($expectedPaths.Count -ne 32) {
  throw "Expected exactly 32 mainline paths; observed $($expectedPaths.Count)."
}
$sourcePaths = @($expectedPaths | Where-Object { $_ -ne "pnpm-lock.yaml" })

Invoke-Checked "Install and regenerate the exact workspace lockfile" {
  pnpm install --no-frozen-lockfile
}
Invoke-Checked "Format only the declared candidate paths" {
  pnpm exec biome format --write @sourcePaths
}
Invoke-Checked "Verify the regenerated lockfile is frozen" {
  pnpm install --frozen-lockfile
}
Invoke-Checked "Run dependency-free source contracts" {
  pnpm source:check
}
Invoke-Checked "Typecheck Adventure Design" {
  pnpm --filter @evavo/adventure-design typecheck
}
Invoke-Checked "Typecheck the browser Player" {
  pnpm --filter @evavo/adventure-player typecheck
}
Invoke-Checked "Typecheck the Studio" {
  pnpm --filter @evavo/adventure-studio-app typecheck
}
Invoke-Checked "Run focused DGDS and regression tests" {
  pnpm exec vitest run `
    packages/adventure-design/tests/dynamix-cinematic.test.ts `
    packages/adventure-design/tests/reference-fidelity-dynamix.test.ts `
    packages/adventure-design/tests/reference-fidelity.test.ts `
    packages/adventure-design/tests/production-profiles.test.ts `
    packages/adventure-design/tests/production-showcases.test.ts `
    apps/player/tests/dead-channel-cinematic-player.test.ts
}
Invoke-Checked "Build the Player" {
  pnpm run build:player
}
Invoke-Checked "Build the Studio" {
  pnpm run build:studio
}
Invoke-Checked "Run the complete repository verification chain" {
  pnpm run check:ci
}

foreach ($path in $expectedPaths) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Candidate path '$path' is missing after validation."
  }
}

Invoke-Checked "Register intent-to-add paths for exact diff inspection" {
  git add -N -- @expectedPaths
}
$actualPaths = @(
  git diff --name-only $BaseSha -- |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ -ne "" } |
    Sort-Object
)
$expectedSorted = @($expectedPaths | Sort-Object)
if (Compare-Object -ReferenceObject $expectedSorted -DifferenceObject $actualPaths) {
  Write-Host "Expected paths:"
  $expectedSorted | ForEach-Object { Write-Host "  $_" }
  Write-Host "Actual paths:"
  $actualPaths | ForEach-Object { Write-Host "  $_" }
  throw "Validated candidate path scope does not match the exact 32-path contract."
}
Invoke-Checked "Check candidate whitespace" {
  git diff --check $BaseSha --
}

if (Test-Path -LiteralPath $CandidateRoot) {
  Remove-Item -LiteralPath $CandidateRoot -Recurse -Force
}
$filesRoot = Join-Path $CandidateRoot "files"
New-Item -ItemType Directory -Path $filesRoot -Force | Out-Null

$hashRecords = foreach ($path in $expectedPaths) {
  $destination = Join-Path $filesRoot $path
  $destinationParent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  Copy-Item -LiteralPath $path -Destination $destination -Force
  $item = Get-Item -LiteralPath $path
  $hash = Get-FileHash -LiteralPath $path -Algorithm SHA256
  [ordered]@{
    path = $path
    bytes = $item.Length
    sha256 = $hash.Hash.ToLowerInvariant()
  }
}

$lockHash = ($hashRecords | Where-Object { $_.path -eq "pnpm-lock.yaml" }).sha256
$receipt = [ordered]@{
  schemaVersion = "1.0"
  status = "passed"
  repository = "EVAVO-STUDIO/evavo-adventure-studio"
  baseSha = $BaseSha
  candidateWorkflowSha = $env:GITHUB_SHA
  runner = $RunnerLabel
  node = (node --version).Trim()
  pnpm = (pnpm --version).Trim()
  changedPathCount = $expectedPaths.Count
  lockfileSha256 = $lockHash
  fullRepositoryCheck = "passed"
  providerMutation = "not-performed"
  deployment = "disabled"
}

$hashRecords | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $CandidateRoot "sha256.json") -Encoding utf8
$receipt | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $CandidateRoot "receipt.json") -Encoding utf8
Write-Host ($receipt | ConvertTo-Json -Depth 5)
