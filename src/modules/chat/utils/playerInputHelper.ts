/**
 * PlayerInput 辅助函数
 * 用于跨组件通信，填入选项内容到输入框
 */

/**
 * 填入选项内容的辅助函数
 * @param choice - 要填入的选项文本
 * @external 此函数被 GameView.tsx 使用
 */
export function fillPlayerInput(choice: string): void {
  window.dispatchEvent(new CustomEvent("lyra:fill-choice", { detail: choice }));
}
