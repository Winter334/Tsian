export interface OpposedCheckResult {
  attackerRoll: number;
  attackerModifier: number;
  attackerTotal: number;
  defenderRoll: number;
  defenderModifier: number;
  defenderTotal: number;
  success: boolean;
  margin: number;
}

function normalizeRoll(rawRoll: unknown): number {
  if (typeof rawRoll !== "number" || !Number.isFinite(rawRoll)) {
    throw new Error(`无效的掷骰结果：${String(rawRoll)}`);
  }
  return rawRoll;
}

export function executeOpposedCheck(
  attackerSkillMod: number,
  defenderSkillMod: number,
  rollFn: () => number = () => {
    const raw = Math.floor(Math.random() * 20) + 1;
    return raw;
  },
): OpposedCheckResult {
  const attackerRoll = normalizeRoll(rollFn());
  const defenderRoll = normalizeRoll(rollFn());

  const attackerTotal = attackerRoll + attackerSkillMod;
  const defenderTotal = defenderRoll + defenderSkillMod;
  const success = attackerTotal > defenderTotal;
  const margin = attackerTotal - defenderTotal;

  return {
    attackerRoll,
    attackerModifier: attackerSkillMod,
    attackerTotal,
    defenderRoll,
    defenderModifier: defenderSkillMod,
    defenderTotal,
    success,
    margin,
  };
}
