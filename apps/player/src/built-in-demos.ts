export interface BuiltInRuntimeDemoDescriptor {
  readonly bundlePath: string;
  readonly lifecyclePath?: string;
}

export const builtInRuntimeDemos = {
  "red-ledger": {
    bundlePath: "/demos/the-red-ledger/runtime.bundle.json",
    lifecyclePath: "lifecycle.json",
  },
} as const satisfies Record<string, BuiltInRuntimeDemoDescriptor>;

export type BuiltInRuntimeDemoId = keyof typeof builtInRuntimeDemos;

const runtimeDemoRequestPath = (descriptor: BuiltInRuntimeDemoDescriptor): string => {
  if (!descriptor.lifecyclePath) return descriptor.bundlePath;
  const hash = new URLSearchParams({ lifecycle: descriptor.lifecyclePath });
  return `${descriptor.bundlePath}#${hash.toString()}`;
};

export const builtInRuntimeDemoBundlePath = (demoId: string | null): string | null => {
  if (!demoId) return null;
  return Object.hasOwn(builtInRuntimeDemos, demoId)
    ? runtimeDemoRequestPath(builtInRuntimeDemos[demoId as BuiltInRuntimeDemoId])
    : null;
};

export const requestedRuntimeBundleFromSearch = (search: string): string | null => {
  const parameters = new URLSearchParams(search);
  const explicitBundle = parameters.get("bundle")?.trim();
  if (explicitBundle) return explicitBundle;
  return builtInRuntimeDemoBundlePath(parameters.get("demo"));
};
