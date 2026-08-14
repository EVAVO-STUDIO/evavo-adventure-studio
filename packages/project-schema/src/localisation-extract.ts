import type { Action, AdventureProject } from "./index.js";
import type { LocalisationSourceEntry } from "./localisation-types.js";

const addSourceEntry = (
  entries: LocalisationSourceEntry[],
  entry: LocalisationSourceEntry,
): void => {
  if (entry.text.length === 0) return;
  entries.push(entry);
};

const extractSayActions = (
  entries: LocalisationSourceEntry[],
  actions: readonly Action[],
  keyPrefix: string,
  pathPrefix: string,
  ownerId: string,
): void => {
  actions.forEach((action, actionIndex) => {
    if (action.kind !== "say") return;
    addSourceEntry(entries, {
      key: `${keyPrefix}.action.${actionIndex}.say`,
      role: "action-say",
      ownerId,
      sourcePath: `${pathPrefix}[${actionIndex}].text`,
      text: action.text,
    });
  });
};

export const extractLocalisableText = (
  project: AdventureProject,
): readonly LocalisationSourceEntry[] => {
  const entries: LocalisationSourceEntry[] = [];

  addSourceEntry(entries, {
    key: "project.title",
    role: "project-title",
    ownerId: project.id,
    sourcePath: "title",
    text: project.title,
  });

  project.scenes.forEach((scene, sceneIndex) => {
    const scenePath = `scenes[${sceneIndex}]`;
    addSourceEntry(entries, {
      key: `${scene.id}.name`,
      role: "scene-name",
      ownerId: scene.id,
      sourcePath: `${scenePath}.name`,
      text: scene.name,
    });
    addSourceEntry(entries, {
      key: `${scene.id}.fallback`,
      role: "scene-fallback",
      ownerId: scene.id,
      sourcePath: `${scenePath}.fallbackText`,
      text: scene.fallbackText,
    });

    scene.hotspots.forEach((hotspot, hotspotIndex) => {
      const hotspotPath = `${scenePath}.hotspots[${hotspotIndex}]`;
      addSourceEntry(entries, {
        key: `${hotspot.id}.name`,
        role: "hotspot-name",
        ownerId: hotspot.id,
        sourcePath: `${hotspotPath}.name`,
        text: hotspot.name,
      });
      if (hotspot.fallbackText !== undefined) {
        addSourceEntry(entries, {
          key: `${hotspot.id}.fallback`,
          role: "hotspot-fallback",
          ownerId: hotspot.id,
          sourcePath: `${hotspotPath}.fallbackText`,
          text: hotspot.fallbackText,
        });
      }
      hotspot.interactions.forEach((interaction, interactionIndex) => {
        extractSayActions(
          entries,
          interaction.actions,
          `${interaction.id}`,
          `${hotspotPath}.interactions[${interactionIndex}].actions`,
          interaction.id,
        );
      });
    });
  });

  project.actors.forEach((actor, actorIndex) => {
    addSourceEntry(entries, {
      key: `${actor.id}.name`,
      role: "actor-name",
      ownerId: actor.id,
      sourcePath: `actors[${actorIndex}].name`,
      text: actor.name,
    });
  });

  project.dialogues.forEach((dialogue, dialogueIndex) => {
    const dialoguePath = `dialogues[${dialogueIndex}]`;
    addSourceEntry(entries, {
      key: `${dialogue.id}.name`,
      role: "dialogue-name",
      ownerId: dialogue.id,
      sourcePath: `${dialoguePath}.name`,
      text: dialogue.name,
    });

    dialogue.nodes.forEach((node, nodeIndex) => {
      const nodePath = `${dialoguePath}.nodes[${nodeIndex}]`;
      extractSayActions(
        entries,
        node.enterActions,
        `${node.id}.enter`,
        `${nodePath}.enterActions`,
        node.id,
      );
      node.lines.forEach((line, lineIndex) => {
        addSourceEntry(entries, {
          key: `${line.id}.text`,
          role: "dialogue-line",
          ownerId: line.id,
          sourcePath: `${nodePath}.lines[${lineIndex}].text`,
          text: line.text,
        });
      });
      node.choices.forEach((choice, choiceIndex) => {
        const choicePath = `${nodePath}.choices[${choiceIndex}]`;
        addSourceEntry(entries, {
          key: `${choice.id}.text`,
          role: "dialogue-choice",
          ownerId: choice.id,
          sourcePath: `${choicePath}.text`,
          text: choice.text,
        });
        extractSayActions(
          entries,
          choice.actions,
          `${choice.id}`,
          `${choicePath}.actions`,
          choice.id,
        );
      });
      extractSayActions(
        entries,
        node.exitActions,
        `${node.id}.exit`,
        `${nodePath}.exitActions`,
        node.id,
      );
    });
  });

  project.sequences.forEach((sequence, sequenceIndex) => {
    const sequencePath = `sequences[${sequenceIndex}]`;
    addSourceEntry(entries, {
      key: `${sequence.id}.name`,
      role: "sequence-name",
      ownerId: sequence.id,
      sourcePath: `${sequencePath}.name`,
      text: sequence.name,
    });

    sequence.skip.completionActions.forEach((action, actionIndex) => {
      if (action.kind !== "say") return;
      addSourceEntry(entries, {
        key: `${sequence.id}.skip.action.${actionIndex}.say`,
        role: "action-say",
        ownerId: sequence.id,
        sourcePath: `${sequencePath}.skip.completionActions[${actionIndex}].text`,
        text: action.text,
      });
    });

    sequence.tracks.forEach((track, trackIndex) => {
      track.cues.forEach((cue, cueIndex) => {
        const cuePath = `${sequencePath}.tracks[${trackIndex}].cues[${cueIndex}]`;
        if (cue.kind === "speech") {
          addSourceEntry(entries, {
            key: `${sequence.id}.${track.id}.cue.${cueIndex}.speech`,
            role: "sequence-speech",
            ownerId: sequence.id,
            sourcePath: `${cuePath}.text`,
            text: cue.text,
          });
        } else if (cue.kind === "story-action" && cue.action.kind === "say") {
          addSourceEntry(entries, {
            key: `${sequence.id}.${track.id}.cue.${cueIndex}.say`,
            role: "action-say",
            ownerId: sequence.id,
            sourcePath: `${cuePath}.action.text`,
            text: cue.action.text,
          });
        }
      });
    });
  });

  project.inventoryItems.forEach((item, itemIndex) => {
    const itemPath = `inventoryItems[${itemIndex}]`;
    addSourceEntry(entries, {
      key: `${item.id}.name`,
      role: "inventory-name",
      ownerId: item.id,
      sourcePath: `${itemPath}.name`,
      text: item.name,
    });
    addSourceEntry(entries, {
      key: `${item.id}.description`,
      role: "inventory-description",
      ownerId: item.id,
      sourcePath: `${itemPath}.description`,
      text: item.description,
    });
  });

  return entries.sort((left, right) => left.key.localeCompare(right.key));
};

export const localisationPlaceholders = (text: string): readonly string[] => {
  const placeholders: string[] = [];
  const pattern = /\{([A-Za-z_][A-Za-z0-9_.-]*)\}/g;
  for (const match of text.matchAll(pattern)) {
    const placeholder = match[1];
    if (placeholder !== undefined) placeholders.push(placeholder);
  }
  return placeholders.sort((left, right) => left.localeCompare(right));
};
