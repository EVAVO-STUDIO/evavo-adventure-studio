import { type Id, idSchema } from "@evavo/adventure-project-schema";
import {
  type LocalisationCoverageSummary,
  type LocalisationIssue,
  type LocalisationSourceEntry,
  type LocalisationTextRole,
  localisationTextRoleSchema,
} from "@evavo/adventure-project-schema/localisation";
import { z } from "zod";

export const localisationTextFitRuleSchema = z
  .object({
    id: z.string().min(1),
    roles: z.array(localisationTextRoleSchema).min(1),
    fontId: idSchema("bitmap-font"),
    maxWidth: z.number().int().positive(),
    maxHeight: z.number().int().positive(),
    maxLines: z.number().int().positive(),
    alignment: z.enum(["left", "center", "right"]).default("left"),
    lineSpacing: z.number().int().nonnegative().default(0),
    tabSpaces: z.number().int().positive().default(4),
    overflowSeverity: z.enum(["error", "warning"]).default("error"),
    glyphSeverity: z.enum(["error", "warning"]).default("error"),
  })
  .strict();
export interface LocalisationTextFitRule {
  readonly id: string;
  readonly roles: readonly LocalisationTextRole[];
  readonly fontId: Id<"bitmap-font">;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly maxLines: number;
  readonly alignment: "left" | "center" | "right";
  readonly lineSpacing: number;
  readonly tabSpaces: number;
  readonly overflowSeverity: "error" | "warning";
  readonly glyphSeverity: "error" | "warning";
}

export const localisationTextFitProfileSchema = z
  .object({
    profileVersion: z.literal(1),
    projectId: idSchema("project"),
    rules: z.array(localisationTextFitRuleSchema).min(1),
  })
  .strict();
export interface LocalisationTextFitProfile {
  readonly profileVersion: 1;
  readonly projectId: Id<"project">;
  readonly rules: readonly LocalisationTextFitRule[];
}

export const parseLocalisationTextFitProfile = (input: unknown): LocalisationTextFitProfile =>
  localisationTextFitProfileSchema.parse(input) as LocalisationTextFitProfile;

export type LocalisationTextFitIssueCode =
  | "text-fit-project-mismatch"
  | "text-fit-font-project-mismatch"
  | "duplicate-text-fit-rule-id"
  | "duplicate-text-fit-role"
  | "missing-text-fit-rule"
  | "missing-text-fit-font"
  | "localised-text-overflow"
  | "localised-text-missing-glyph";

export interface LocalisationTextFitIssue {
  readonly severity: "error" | "warning";
  readonly code: LocalisationTextFitIssueCode;
  readonly path: string;
  readonly message: string;
  readonly locale?: string;
  readonly key?: string;
  readonly ruleId?: string;
}

export type LocalisationAuditIssue = LocalisationIssue | LocalisationTextFitIssue;

export interface LocalisationTextFitResult {
  readonly locale: string;
  readonly key: string;
  readonly role: LocalisationTextRole;
  readonly text: string;
  readonly resolvedLocale: string;
  readonly sourceFallback: boolean;
  readonly ruleId: string;
  readonly fontId: Id<"bitmap-font">;
  readonly maxWidth: number;
  readonly maxHeight: number;
  readonly maxLines: number;
  readonly contentWidth: number;
  readonly contentHeight: number;
  readonly lineCount: number;
  readonly widthOverflow: number;
  readonly heightOverflow: number;
  readonly lineOverflow: number;
  readonly fallbackCodePoints: readonly number[];
  readonly fits: boolean;
}

export interface LocalisationAuditReport {
  readonly projectId: Id<"project">;
  readonly sourceLocale: string;
  readonly sourceEntries: readonly LocalisationSourceEntry[];
  readonly coverage: readonly LocalisationCoverageSummary[];
  readonly fitResults: readonly LocalisationTextFitResult[];
  readonly issues: readonly LocalisationAuditIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly verified: boolean;
}
