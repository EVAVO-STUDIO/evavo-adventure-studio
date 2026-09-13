import { z } from "zod";
import { type Id, idSchema } from "./index.js";

export const classicFrontEndMenuLabelsSchema = z
  .object({
    newGame: z.string().min(1),
    continueGame: z.string().min(1),
    loadGame: z.string().min(1),
    options: z.string().min(1),
    credits: z.string().min(1),
    quit: z.string().min(1),
    quickSave: z.string().min(1),
    back: z.string().min(1),
    fullscreen: z.string().min(1),
  })
  .strict();
export type ClassicFrontEndMenuLabels = z.infer<typeof classicFrontEndMenuLabelsSchema>;

export const classicFrontEndManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    publisher: z
      .object({
        name: z.string().min(1).max(48),
        presents: z.string().min(1).max(80),
        splashDurationTicks: z.number().int().min(1).max(600),
        splashSkipAfterTicks: z.number().int().min(0).max(600),
      })
      .strict(),
    title: z
      .object({
        kicker: z.string().min(1).max(96),
      })
      .strict(),
    menu: z
      .object({
        labels: classicFrontEndMenuLabelsSchema,
        showContinue: z.boolean(),
        showLoad: z.boolean(),
        showOptions: z.boolean(),
        showCredits: z.boolean(),
        showQuit: z.boolean(),
      })
      .strict(),
    options: z
      .object({
        allowFullscreen: z.boolean(),
      })
      .strict(),
    credits: z
      .object({
        lines: z.array(z.string().min(1).max(96)).max(24),
      })
      .strict(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.publisher.splashSkipAfterTicks > value.publisher.splashDurationTicks) {
      context.addIssue({
        code: "custom",
        path: ["publisher", "splashSkipAfterTicks"],
        message: "Splash skip timing cannot exceed the total splash duration.",
      });
    }
  });

export type ClassicFrontEndManifest = z.infer<typeof classicFrontEndManifestSchema>;

export const parseClassicFrontEndManifest = (input: unknown): ClassicFrontEndManifest =>
  classicFrontEndManifestSchema.parse(input);

export const createDefaultClassicFrontEndManifest = (
  projectId: Id<"project">,
): ClassicFrontEndManifest =>
  parseClassicFrontEndManifest({
    manifestVersion: 1,
    projectId,
    publisher: {
      name: "EVAVO",
      presents: "ADVENTURE STUDIO PRESENTS",
      splashDurationTicks: 96,
      splashSkipAfterTicks: 18,
    },
    title: {
      kicker: "A CLASSIC POINT & CLICK ADVENTURE",
    },
    menu: {
      labels: {
        newGame: "NEW GAME",
        continueGame: "CONTINUE",
        loadGame: "LOAD GAME",
        options: "OPTIONS",
        credits: "CREDITS",
        quit: "QUIT",
        quickSave: "QUICK SAVE",
        back: "BACK",
        fullscreen: "TOGGLE FULLSCREEN",
      },
      showContinue: true,
      showLoad: true,
      showOptions: true,
      showCredits: true,
      showQuit: true,
    },
    options: {
      allowFullscreen: true,
    },
    credits: {
      lines: ["RUNNING ON EVAVO ADVENTURE STUDIO"],
    },
  });