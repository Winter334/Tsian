/**
 * ContentProcessor - 内容处理服务
 * 模块化的内容转换器注册系统
 */

type ContentTransformer = (content: string) => string;

class ContentProcessor {
  private transformers: Map<string, ContentTransformer> = new Map();

  /**
   * 注册转换器
   * @param id 唯一标识符
   * @param transformer 转换函数
   */
  register(id: string, transformer: ContentTransformer): void {
    this.transformers.set(id, transformer);
  }

  /**
   * 注销转换器
   * @param id 转换器标识符
   */
  unregister(id: string): void {
    this.transformers.delete(id);
  }

  /**
   * 处理内容
   * 依次应用所有注册的转换器
   * @param content 原始内容
   * @returns 处理后的内容
   */
  process(content: string): string {
    let result = content;
    for (const transformer of this.transformers.values()) {
      result = transformer(result);
    }
    return result;
  }

  /**
   * 获取已注册的转换器数量
   */
  get size(): number {
    return this.transformers.size;
  }

  /**
   * 检查转换器是否已注册
   */
  has(id: string): boolean {
    return this.transformers.has(id);
  }

  /**
   * 清空所有转换器
   */
  clear(): void {
    this.transformers.clear();
  }
}

/** 全局 ContentProcessor 实例 */
export const contentProcessor = new ContentProcessor();

export type { ContentTransformer };
