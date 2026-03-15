import type { ContextEnvelope } from "@/domain/types/envelope";
import type { PlayerInfo, VariableContext } from "@/lib/prompt/types";

interface ToVariableContextExtra {
  user: PlayerInfo;
  players?: PlayerInfo[];
  scenario?: string;
  worldInfo?: string;
  gameState?: VariableContext["gameState"];
  resultFrame?: VariableContext["resultFrame"];
  operationDefinitions?: string;
  entityEffects?: VariableContext["entityEffects"];
  entityDisplayNames?: VariableContext["entityDisplayNames"];
  worldConfig?: VariableContext["worldConfig"];
  activeNpcs?: VariableContext["activeNpcs"];
  inventoryData?: VariableContext["inventoryData"];
  manualMemories?: VariableContext["manualMemories"];
  archiveData?: VariableContext["archiveData"];
  customVariables?: Record<string, string>;
}

export function toVariableContext(
  envelope: ContextEnvelope,
  extra: ToVariableContextExtra,
): VariableContext {
  const actionTimestamp = envelope.turn.submittedAt ?? Date.now();

  return {
    mode: envelope.session.mode,
    chatHistory: envelope.history.messages,
    userInput: envelope.turn.userInput,
    turn: {
      number: envelope.turn.number,
      actions: [
        {
          content: envelope.turn.userInput,
          timestamp: actionTimestamp,
        },
      ],
    },
    memoryData: envelope.memory?.segments,
    plotDirectives: envelope.directives?.plotDirectives,
    turnNarrativeIntent: envelope.directives?.turnNarrativeIntent,
    narrativeHints: envelope.directives?.narrativeHints,
    user: extra.user,
    players: extra.players,
    scenario: extra.scenario,
    worldInfo: extra.worldInfo,
    gameState: extra.gameState,
    resultFrame: extra.resultFrame,
    operationDefinitions: extra.operationDefinitions,
    entityEffects: extra.entityEffects,
    entityDisplayNames: extra.entityDisplayNames,
    worldConfig: extra.worldConfig,
    activeNpcs: extra.activeNpcs,
    inventoryData: extra.inventoryData,
    manualMemories: extra.manualMemories,
    archiveData: extra.archiveData,
    customVariables: extra.customVariables,
  };
}
