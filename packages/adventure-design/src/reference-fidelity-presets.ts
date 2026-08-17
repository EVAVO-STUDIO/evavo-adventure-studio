import type {
  AdventureReferenceEngineDialect,
  AdventureReferenceEngineDialectId,
  AdventureReferenceTitleId,
  AdventureReferenceTitlePack,
} from "./reference-fidelity-types.js";
import { adventureReferenceEngineDialects } from "./reference-fidelity-foundation.js";
import { foaReferenceTitlePack } from "./reference-fidelity-foa.js";
import { gk1ReferenceTitlePack } from "./reference-fidelity-gk1.js";
import { kq5ReferenceTitlePack } from "./reference-fidelity-kq5.js";
import { pq4ReferenceTitlePack } from "./reference-fidelity-pq4.js";
import { qfg4ReferenceTitlePack } from "./reference-fidelity-qfg4.js";

export { adventureReferenceEngineDialects };

export const adventureReferenceTitlePacks: readonly AdventureReferenceTitlePack[] = [
  kq5ReferenceTitlePack,
  qfg4ReferenceTitlePack,
  gk1ReferenceTitlePack,
  pq4ReferenceTitlePack,
  foaReferenceTitlePack,
] as const;

export const adventureReferenceEngineDialectById = (
  id: AdventureReferenceEngineDialectId,
): AdventureReferenceEngineDialect => {
  const dialectValue = adventureReferenceEngineDialects.find((candidate) => candidate.id === id);
  if (!dialectValue) throw new Error(`Adventure reference engine dialect '${id}' is missing.`);
  return dialectValue;
};

export const adventureReferenceTitlePackById = (id: string): AdventureReferenceTitlePack => {
  const packValue = adventureReferenceTitlePacks.find((candidate) => candidate.id === id);
  if (!packValue) throw new Error(`Adventure reference title pack '${id}' is missing.`);
  return packValue;
};

export const adventureReferenceTitlePackByTitleId = (
  titleId: AdventureReferenceTitleId,
): AdventureReferenceTitlePack => {
  const packValue = adventureReferenceTitlePacks.find((candidate) => candidate.titleId === titleId);
  if (!packValue) throw new Error(`Adventure reference title '${titleId}' is missing.`);
  return packValue;
};

export const adventureReferenceTitlePackByVariantId = (
  variantId: string,
): AdventureReferenceTitlePack => {
  const packValue = adventureReferenceTitlePacks.find((candidate) =>
    candidate.variants.some((variantValue) => variantValue.id === variantId),
  );
  if (!packValue) throw new Error(`Adventure reference variant '${variantId}' is missing.`);
  return packValue;
};
