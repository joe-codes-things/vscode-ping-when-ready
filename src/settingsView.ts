import * as vscode from "vscode";

type ToggleKey =
  | "notifications.macOS"
  | "notifications.sound"
  | "notifications.iMessage"
  | "notifications.includeSummary";

type SettingsItem =
  | { kind: "toggle"; key: ToggleKey; label: string; tooltip: string }
  | { kind: "action"; label: string; command: string; tooltip: string };

const toggleItems: SettingsItem[] = [
  {
    kind: "toggle",
    key: "notifications.macOS",
    label: "macOS Notifications",
    tooltip: "Show native macOS notification banners.",
  },
  {
    kind: "toggle",
    key: "notifications.sound",
    label: "Sound",
    tooltip: "Play the configured notification sound.",
  },
  {
    kind: "toggle",
    key: "notifications.iMessage",
    label: "iMessage",
    tooltip: "Send notification messages through Messages.",
  },
  {
    kind: "toggle",
    key: "notifications.includeSummary",
    label: "Include Summary",
    tooltip: "Include a short response or question excerpt in notifications.",
  },
];

const actionItems: SettingsItem[] = [
  {
    kind: "action",
    label: "Choose Response Sound…",
    command: "pingWhenReady.chooseResponseSound",
    tooltip: "Choose a WAV or MP3 sound for completed agent responses.",
  },
  {
    kind: "action",
    label: "Choose Question Sound…",
    command: "pingWhenReady.chooseQuestionSound",
    tooltip: "Choose a WAV or MP3 sound for agent questions.",
  },
  {
    kind: "action",
    label: "Set iMessage Recipient…",
    command: "pingWhenReady.setIMessageRecipient",
    tooltip: "Securely store the recipient for iMessage notifications.",
  },
];

export class SettingsTreeDataProvider implements vscode.TreeDataProvider<SettingsItem> {
  private readonly changeEmitter = new vscode.EventEmitter<SettingsItem | undefined>();
  readonly onDidChangeTreeData = this.changeEmitter.event;
  readonly items: readonly SettingsItem[] = [...toggleItems, ...actionItems];

  getTreeItem(item: SettingsItem): vscode.TreeItem {
    const treeItem = new vscode.TreeItem(item.label);
    treeItem.tooltip = item.tooltip;
    if (item.kind === "toggle") {
      treeItem.checkboxState = this.isEnabled(item.key)
        ? vscode.TreeItemCheckboxState.Checked
        : vscode.TreeItemCheckboxState.Unchecked;
    } else {
      treeItem.command = {
        command: item.command,
        title: item.label,
      };
    }
    return treeItem;
  }

  getChildren(): SettingsItem[] {
    return [...this.items];
  }

  async setChecked(item: SettingsItem, checked: boolean): Promise<void> {
    if (item.kind !== "toggle") {
      return;
    }
    await vscode.workspace
      .getConfiguration("pingWhenReady")
      .update(item.key, checked, vscode.ConfigurationTarget.Global);
    this.refresh();
  }

  refresh(): void {
    this.changeEmitter.fire(undefined);
  }

  dispose(): void {
    this.changeEmitter.dispose();
  }

  private isEnabled(key: ToggleKey): boolean {
    const fallback = key === "notifications.macOS" || key === "notifications.includeSummary";
    return vscode.workspace.getConfiguration("pingWhenReady").get<boolean>(key, fallback);
  }
}
