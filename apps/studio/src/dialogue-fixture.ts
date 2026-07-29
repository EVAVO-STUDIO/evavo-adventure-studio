import { dialogueGraphSchema } from "@evavo/adventure-project-schema";

export const studioDialogueGraph = dialogueGraphSchema.parse({
  id: "dialogue.detective.receptionist",
  name: "The Missing Ledger",
  startNodeId: "dialogue-node.receptionist.opening",
  nodes: [
    {
      id: "dialogue-node.receptionist.opening",
      lines: [
        {
          id: "dialogue-line.receptionist.opening",
          speakerId: "actor.receptionist",
          text: "You took your time, detective.",
          animationState: "idle",
        },
      ],
      choices: [
        {
          id: "dialogue-choice.receptionist.ask-ledger",
          text: "Ask about the missing ledger.",
          nextNodeId: "dialogue-node.receptionist.ledger",
        },
        {
          id: "dialogue-choice.receptionist.ask-blackout",
          text: "Ask who was here during the blackout.",
          nextNodeId: "dialogue-node.receptionist.blackout",
        },
        {
          id: "dialogue-choice.receptionist.leave",
          text: "End the interview.",
          closeDialogue: true,
        },
      ],
    },
    {
      id: "dialogue-node.receptionist.ledger",
      lines: [
        {
          id: "dialogue-line.receptionist.ledger",
          speakerId: "actor.receptionist",
          text: "It was on the desk before the lights failed.",
        },
        {
          id: "dialogue-line.detective.ledger",
          speakerId: "actor.detective",
          text: "And afterwards?",
        },
      ],
      choices: [
        {
          id: "dialogue-choice.receptionist.press-ledger",
          text: "Press for a name.",
          nextNodeId: "dialogue-node.receptionist.suspect",
          once: true,
        },
        {
          id: "dialogue-choice.receptionist.return-opening",
          text: "Ask about something else.",
          nextNodeId: "dialogue-node.receptionist.opening",
        },
      ],
    },
    {
      id: "dialogue-node.receptionist.blackout",
      lines: [
        {
          id: "dialogue-line.receptionist.blackout",
          speakerId: "actor.receptionist",
          text: "The porter, two clerks, and a man who would not give his name.",
        },
      ],
      choices: [
        {
          id: "dialogue-choice.receptionist.describe-stranger",
          text: "Ask for a description.",
          nextNodeId: "dialogue-node.receptionist.suspect",
        },
        {
          id: "dialogue-choice.receptionist.return-opening-2",
          text: "Return to the first questions.",
          nextNodeId: "dialogue-node.receptionist.opening",
        },
      ],
    },
    {
      id: "dialogue-node.receptionist.suspect",
      lines: [
        {
          id: "dialogue-line.receptionist.suspect",
          speakerId: "actor.receptionist",
          text: "Grey coat. Red gloves. He watched the rain instead of the room.",
        },
      ],
      choices: [
        {
          id: "dialogue-choice.receptionist.record-clue",
          text: "Record the description and finish.",
          actions: [
            { kind: "set-flag", flag: "clue.red-gloves", value: true },
            {
              kind: "award-score",
              awardId: "score.receptionist.red-gloves",
              points: 5,
            },
          ],
          closeDialogue: true,
          once: true,
        },
      ],
    },
  ],
});
