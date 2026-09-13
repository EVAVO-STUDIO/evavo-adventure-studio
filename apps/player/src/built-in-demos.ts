export interface BuiltInRuntimeDemoDescriptor {
  readonly bundlePath: string;
  readonly frontEndPath?: string;
  readonly lifecyclePath?: string;
}

export const builtInRuntimeDemos = {
  "red-ledger": {
    bundlePath: "/demos/the-red-ledger/runtime.bundle.json",
    frontEndPath: "front-end.json",
    lifecyclePath: "lifecycle.json",
  },
} as const satisfies Record<string, BuiltInRuntimeDemoDescriptor>;

export type BuiltInRuntimeDemoId = keyof typeof builtInRuntimeDemos;

const runtimeDemoRequestPath = (descriptor: BuiltInRuntimeDemoDescriptor): string => {
  const hash = new URLSearchParams();
  if (descriptor.frontEndPath) hash.set("frontEnd", descriptor.frontEndPath);
  if (descriptor.lifecyclePath) hash.set("lifecycle", descriptor.lifecyclePath);
  const encoded = hash.toString();
  return encoded ? `${descriptor.bundlePath}#${encoded}` : descriptor.bundlePath;
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
