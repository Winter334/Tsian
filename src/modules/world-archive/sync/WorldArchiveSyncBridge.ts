import * as Y from "yjs";

import {
  WORLD_ARCHIVE_WRITE_ORIGIN,
  type WorldArchiveRepository,
} from "../repository";
import { useWorldArchiveStore } from "../store";

interface DestroyOptions {
  clearStore?: boolean;
}

/**
 * WorldArchiveSyncBridge
 *
 * 负责将 worldArchive.entities 的 Yjs 变化持续同步到 Zustand Store。
 */
export class WorldArchiveSyncBridge {
  private destroyed = false;
  private unobserveEntities: (() => void) | null = null;

  constructor(private readonly repository: WorldArchiveRepository) {}

  hydrate(): void {
    if (this.destroyed) {
      return;
    }

    const entities = this.repository.getAllEntities();
    useWorldArchiveStore.getState()._setEntities(entities);
  }

  startObserving(): void {
    if (this.destroyed || this.unobserveEntities) {
      return;
    }

    this.unobserveEntities = this.repository.observeEntities(
      (event: Y.YMapEvent<string>) => {
        if (this.destroyed) {
          return;
        }

        // 防回环：本端仓储写入（Command -> Repository -> Yjs）已在 Store 同步过，
        // 跳过本次 observe 回调，仅消费远端/其他来源变更。
        if (event.transaction.origin === WORLD_ARCHIVE_WRITE_ORIGIN) {
          return;
        }

        this.hydrate();
      },
    );
  }

  destroy(options: DestroyOptions = {}): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;

    if (this.unobserveEntities) {
      this.unobserveEntities();
      this.unobserveEntities = null;
    }

    if (options.clearStore ?? true) {
      useWorldArchiveStore.getState()._clear();
    }
  }
}
