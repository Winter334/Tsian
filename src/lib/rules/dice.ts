/**
 * 骰子解析与投掷（G1 骨架）
 */

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceRollResult {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const DICE_PATTERN = /^(\d+)d(\d+)([+-]\d+)?$/i;
const DICE_IN_TEXT_PATTERN = /(\d+d\d+(?:[+-]\d+)?)/gi;

export function parseDiceExpression(expression: string): DiceSpec | null {
  const normalized = expression.replace(/\s+/g, "");
  const matched = normalized.match(DICE_PATTERN);
  if (!matched) return null;

  const count = Number(matched[1]);
  const sides = Number(matched[2]);
  const modifier = matched[3] ? Number(matched[3]) : 0;

  if (
    !Number.isInteger(count) ||
    !Number.isInteger(sides) ||
    count <= 0 ||
    sides <= 0
  ) {
    return null;
  }

  return { count, sides, modifier };
}

export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollDiceExpression(
  expression: string,
  random: () => number
): DiceRollResult {
  const spec = parseDiceExpression(expression);
  if (!spec) {
    throw new Error(`Invalid dice expression: ${expression}`);
  }

  const rolls: number[] = [];
  for (let i = 0; i < spec.count; i += 1) {
    const value = Math.floor(random() * spec.sides) + 1;
    rolls.push(value);
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0) + spec.modifier;
  return {
    expression: expression.replace(/\s+/g, ""),
    rolls,
    modifier: spec.modifier,
    total,
  };
}

export interface DicePreprocessResult {
  expression: string;
  diceRolls: DiceRollResult[];
}

export function preprocessDiceInExpression(
  expression: string,
  random: () => number
): DicePreprocessResult {
  const diceRolls: DiceRollResult[] = [];
  const processed = expression.replace(DICE_IN_TEXT_PATTERN, (match) => {
    const roll = rollDiceExpression(match, random);
    diceRolls.push(roll);
    return String(roll.total);
  });

  return {
    expression: processed,
    diceRolls,
  };
}
