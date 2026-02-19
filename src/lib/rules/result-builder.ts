/**
 * ResultFrame 构建器（G1 骨架）
 */

import type {
  Check,
  DiceRoll,
  ModifierApplication,
  ResultFrame,
  StructuralChange,
  ValueChange,
} from "@/domain/types";

export interface ResultFrameBuildInput {
  frameId: string;
  commandId: string;
  seed: number;
  success: boolean;
  timestamp?: number;
  mechanicSummary?: string;
  failureReason?: string;
  valueChanges?: readonly ValueChange[];
  diceRolls?: readonly DiceRoll[];
  checks?: readonly Check[];
  modifiersApplied?: readonly ModifierApplication[];
  structuralChanges?: readonly StructuralChange[];
  hash?: string;
}

export function buildResultFrame(input: ResultFrameBuildInput): ResultFrame {
  return {
    version: 1,
    frameId: input.frameId,
    commandId: input.commandId,
    seed: input.seed,
    timestamp: input.timestamp ?? Date.now(),
    hash: input.hash,
    success: input.success,
    failureReason: input.failureReason,
    valueChanges: input.valueChanges ?? [],
    diceRolls: input.diceRolls ?? [],
    checks: input.checks ?? [],
    modifiersApplied: input.modifiersApplied,
    structuralChanges: input.structuralChanges,
    mechanicSummary: input.mechanicSummary ?? "",
  };
}
