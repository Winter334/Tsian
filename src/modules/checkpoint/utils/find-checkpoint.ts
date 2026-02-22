import type { Checkpoint } from "@/domain/entities/checkpoint";

/**
 * 判断检查点快照中是否包含指定消息
 */
function checkpointContainsMessage(
  checkpoint: Checkpoint,
  messageId: string,
): boolean {
  return Object.values(checkpoint.messages).some((snapshots) =>
    snapshots.some((message) => message.id === messageId),
  );
}

/**
 * 根据 AI 消息 ID 查找对应的检查点
 *
 * 检查点快照是累积历史，旧消息会出现在多个后续检查点中。
 * 因此需要按 createdAt 升序查找，返回"最早包含该消息"的检查点。
 */
export function findCheckpointByMessageId(
  checkpoints: Checkpoint[],
  messageId: string,
): Checkpoint | null {
  const sortedAsc = [...checkpoints].sort((a, b) => a.createdAt - b.createdAt);

  for (const checkpoint of sortedAsc) {
    if (checkpointContainsMessage(checkpoint, messageId)) {
      return checkpoint;
    }
  }

  return null;
}

/**
 * 查找某条 AI 消息的"上一个"检查点（用于重新生成）
 *
 * 返回该 AI 消息对应检查点的前一个检查点。
 * 检查点按 createdAt 升序排列后，找到最早包含该消息的检查点，返回其前一个。
 */
export function findPreviousCheckpoint(
  checkpoints: Checkpoint[],
  messageId: string,
): Checkpoint | null {
  const sortedAsc = [...checkpoints].sort((a, b) => a.createdAt - b.createdAt);

  for (let index = 0; index < sortedAsc.length; index += 1) {
    if (checkpointContainsMessage(sortedAsc[index], messageId)) {
      return index > 0 ? sortedAsc[index - 1] : null;
    }
  }

  return null;
}
