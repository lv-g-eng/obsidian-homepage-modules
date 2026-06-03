import { Editor, Menu, MenuItem, Notice, Plugin } from "obsidian";
import { AIClient } from "./ai-client";

type Task = { id: string; name: string; icon: string; prompt: (sel: string) => string };

const TASKS: Task[] = [
  {
    id: "translate",
    name: "AI 翻译选中文本",
    icon: "languages",
    prompt: (s) =>
      `将下面的文本翻译：若是中文则译为地道英文，若是英文/其它语言则译为流畅中文。只输出译文，不要解释：\n\n${s}`,
  },
  {
    id: "polish",
    name: "AI 润色选中文本",
    icon: "wand-2",
    prompt: (s) => `润色下面这段文字，使其更流畅、专业、简洁，保持原意与原语言。只输出润色后的文本：\n\n${s}`,
  },
  {
    id: "summarize-sel",
    name: "AI 总结选中文本",
    icon: "scan-text",
    prompt: (s) => `用中文简洁总结下面的文本，3 句以内，只输出要点：\n\n${s}`,
  },
];

async function run(ai: AIClient, editor: Editor, task: Task): Promise<void> {
  const sel = editor.getSelection().trim();
  if (!sel) {
    new Notice("请先选中一段文本");
    return;
  }
  if (!ai.isConfigured()) {
    new Notice("请先在设置中配置 AI");
    return;
  }
  const notice = new Notice("AI 处理中…", 0);
  try {
    const out = await ai.chat({
      messages: [{ role: "user", content: task.prompt(sel) }],
      stream: false,
    });
    notice.hide();
    if (!out) {
      new Notice("AI 返回为空");
      return;
    }
    // 译文/润色 → 替换选区；总结 → 追加在选区下方引用块
    if (task.id === "summarize-sel") {
      editor.replaceSelection(`${sel}\n\n> [!summary] AI 总结\n> ${out.replace(/\n/g, "\n> ")}\n`);
    } else {
      editor.replaceSelection(out);
    }
  } catch (e) {
    notice.hide();
    new Notice((e as Error).message);
  }
}

/**
 * 注册 AI 文本命令：命令面板 + 编辑器右键菜单（选中文本时出现）。
 */
export function registerAICommands(plugin: Plugin, ai: AIClient): void {
  for (const task of TASKS) {
    plugin.addCommand({
      id: `ai-${task.id}`,
      name: task.name,
      icon: task.icon,
      editorCallback: (editor: Editor) => void run(ai, editor, task),
    });
  }

  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
      if (!editor.getSelection().trim()) return;
      for (const task of TASKS) {
        menu.addItem((item: MenuItem) =>
          item.setTitle(task.name).setIcon(task.icon).onClick(() => void run(ai, editor, task))
        );
      }
    })
  );
}
