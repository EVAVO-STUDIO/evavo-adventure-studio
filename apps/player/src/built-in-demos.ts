export const builtInRuntimeDemos = {
  "red-ledger": "/demos/the-red-ledger/runtime.bundle.json",
} as const;

export type BuiltInRuntimeDemoId = keyof typeof builtInRuntimeDemos;

export const builtInRuntimeDemoBundlePath = (demoId: string | null): string | null => {
  if (!demoId) return null;
  return Object.hasOwn(builtInRuntimeDemos, demoId)
    ? builtInRuntimeDemos[demoId as BuiltInRuntimeDemoId]
    : null;
};

export const requestedRuntimeBundleFromSearch = (search: string): string | null => {
  const parameters = new URLSearchParams(search);
  const explicitBundle = parameters.get("bundle")?.trim();
  if (explicitBundle) return explicitBundle;
  return builtInRuntimeDemoBundlePath(parameters.get("demo"));
};
