import * as childProcess from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { installCopilotHook, uninstallCopilotHook } from "./hookConfig";
import { finalAssistantResponseHasQuestionMarker } from "./responseCategory";

const execFile = promisify(childProcess.execFile);
const output = vscode.window.createOutputChannel("Ping When Ready");
const lastSignalByPath = new Map<string, string>();
const activeSounds = new Set<childProcess.ChildProcess>();
const signalFileName = "agent-stop.signal";
const iMessageRecipientKey = "pingWhenReady.iMessageRecipient";
const completionNotification = "Agent response ready for review.";
const questionNotification = "Question from agent pending.";
const iMessageScript = [
  "on run argv",
  "set recipientNumber to item 1 of argv",
  "set messageText to item 2 of argv",
  "tell application \"Messages\"",
  "set targetService to first service whose service type is iMessage",
  "set targetBuddy to buddy recipientNumber of targetService",
  "send messageText to targetBuddy",
  "end tell",
  "end run",
].join("\n");

function setting<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration("pingWhenReady").get<T>(key, fallback);
}

function logError(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  output.appendLine(`${message}: ${detail}`);
  void vscode.window.showErrorMessage(`Ping When Ready: ${message}. See Output > Ping When Ready for details.`);
}

async function showNativeNotification(message: string): Promise<void> {
  await execFile("/usr/bin/osascript", [
    "-e",
    "on run argv",
    "-e",
    "display notification (item 1 of argv) with title (item 2 of argv)",
    "-e",
    "end run",
    message,
    "Ping When Ready",
  ]);
}

async function playSound(): Promise<void> {
  const filePath = setting<string>("soundFile", "");
  if (!filePath) {
    throw new Error("Set Ping When Ready: Sound File to an absolute WAV or MP3 path before enabling sound.");
  }
  if (![".wav", ".mp3"].includes(path.extname(filePath).toLowerCase())) {
    throw new Error("The selected sound file must have a .WAV or .MP3 extension.");
  }
  await fs.access(filePath);

  const process = childProcess.spawn("/usr/bin/afplay", [filePath], { stdio: "ignore" });
  activeSounds.add(process);
  process.once("error", (error) => {
    activeSounds.delete(process);
    logError("Could not play the selected sound", error);
  });
  process.once("exit", (code) => {
    activeSounds.delete(process);
    if (code !== 0 && code !== null) {
      logError(`Sound playback failed with exit code ${code}`, new Error("afplay returned a non-zero exit code."));
    }
  });
}

async function sendIMessage(context: vscode.ExtensionContext, message: string): Promise<void> {
  const recipient = await context.secrets.get(iMessageRecipientKey);
  if (!recipient) {
    throw new Error("Configure the iMessage recipient with Ping When Ready: Set iMessage Recipient before enabling iMessage.");
  }
  try {
    await execFile("/usr/bin/osascript", ["-e", iMessageScript, recipient, message], { timeout: 30_000 });
  } catch {
    throw new Error("Messages automation failed. Check that Messages is signed in and allow automation access in macOS System Settings.");
  }
  output.appendLine("Messages accepted the iMessage send request; delivery is not confirmed.");
}

async function notify(
  context: vscode.ExtensionContext,
  message = completionNotification,
  includeIMessage = true,
): Promise<void> {
  const work: Promise<void>[] = [];
  if (setting<boolean>("notifications.macOS", true)) {
    work.push(showNativeNotification(message));
  }
  if (setting<boolean>("notifications.sound", false)) {
    work.push(playSound());
  }
  if (includeIMessage && setting<boolean>("notifications.iMessage", false)) {
    work.push(sendIMessage(context, message));
  }
  const results = await Promise.allSettled(work);
  for (const result of results) {
    if (result.status === "rejected") {
      logError("A notification channel failed", result.reason);
    }
  }
}

function watchSignalFile(context: vscode.ExtensionContext): void {
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(context.globalStorageUri, signalFileName),
  );
  const handleSignal = async (uri: vscode.Uri): Promise<void> => {
    try {
      const signal = (await fs.readFile(uri.fsPath, "utf8")).trim();
      if (!signal || lastSignalByPath.get(uri.fsPath) === signal) {
        return;
      }
      lastSignalByPath.set(uri.fsPath, signal);
      output.appendLine(`Received Copilot agent-stop signal at ${new Date().toISOString()}.`);
      let message = completionNotification;
      try {
        const event: unknown = JSON.parse(signal);
        const transcriptPath = getTranscriptPath(event);
        if (!transcriptPath) {
          throw new Error("The Copilot stop-hook event did not include a transcript path.");
        }
        if (await finalAssistantResponseHasQuestionMarker(transcriptPath)) {
          message = questionNotification;
        }
      } catch (error) {
        output.appendLine(`Could not classify the agent response; using the completion notification. ${error instanceof Error ? error.message : String(error)}`);
      }
      await notify(context, message);
    } catch (error) {
      logError("Could not process the Copilot agent-stop signal", error);
    }

    function getTranscriptPath(event: unknown): string | undefined {
      if (typeof event !== "object" || event === null) {
        return undefined;
      }
      if ("transcriptPath" in event && typeof event.transcriptPath === "string") {
        return event.transcriptPath;
      }
      if ("transcript_path" in event && typeof event.transcript_path === "string") {
        return event.transcript_path;
      }
      return undefined;
    }
  };

  watcher.onDidCreate((uri) => void handleSignal(uri));
  watcher.onDidChange((uri) => void handleSignal(uri));
  context.subscriptions.push(watcher);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  output.appendLine("Extension activated.");
  context.subscriptions.push(output);

  if (process.platform !== "darwin") {
    vscode.window.showWarningMessage("Ping When Ready currently supports macOS only.");
    return;
  }

  await fs.mkdir(context.globalStorageUri.fsPath, { recursive: true });
  watchSignalFile(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("pingWhenReady.enableCopilotHook", async () => {
      try {
        const signalFilePath = path.join(context.globalStorageUri.fsPath, signalFileName);
        const filePath = await installCopilotHook(context.extensionPath, signalFilePath);
        await fs.rm(signalFilePath, { force: true });
        vscode.window.showInformationMessage(`Copilot agent-stop hook enabled in ${filePath}. Start a new Copilot session to test it.`);
      } catch (error) {
        logError("Could not enable the Copilot agent-stop hook", error);
      }
    }),
    vscode.commands.registerCommand("pingWhenReady.disableCopilotHook", async () => {
      try {
        const filePath = await uninstallCopilotHook();
        vscode.window.showInformationMessage(`Ping When Ready's Copilot agent-stop hook was removed from ${filePath}.`);
      } catch (error) {
        logError("Could not disable the Copilot agent-stop hook", error);
      }
    }),
    vscode.commands.registerCommand("pingWhenReady.setIMessageRecipient", async () => {
      const recipient = await vscode.window.showInputBox({
        prompt: "Enter the iMessage recipient in international format (for example, +14155550123). Stored securely in VS Code SecretStorage.",
        placeHolder: "+14155550123",
        ignoreFocusOut: true,
        validateInput: (value) => /^\+[1-9]\d{7,14}$/.test(value.trim())
          ? undefined
          : "Enter a phone number in international format, starting with + and containing 8–15 digits.",
      });
      if (recipient === undefined) {
        return;
      }
      await context.secrets.store(iMessageRecipientKey, recipient.trim());
      vscode.window.showInformationMessage("The iMessage recipient was saved securely in VS Code SecretStorage.");
    }),
    vscode.commands.registerCommand("pingWhenReady.sendTestIMessage", async () => {
      const confirmation = await vscode.window.showWarningMessage(
        "This sends a real iMessage to the recipient saved in VS Code SecretStorage. Continue?",
        { modal: true },
        "Send Test iMessage",
      );
      if (confirmation !== "Send Test iMessage") {
        return;
      }
      try {
        await sendIMessage(context, "Ping When Ready test message.");
        vscode.window.showInformationMessage("Messages accepted the test send request. Check Messages to verify delivery.");
      } catch (error) {
        logError("Could not send the test iMessage", error);
      }
    }),
    vscode.commands.registerCommand("pingWhenReady.testAgentStopNotification", async () => {
      const includesIMessage = setting<boolean>("notifications.iMessage", false);
      const confirmation = await vscode.window.showWarningMessage(
        includesIMessage
          ? "This simulates an agent-stop notification using your enabled channels and sends a real iMessage. Continue?"
          : "This simulates an agent-stop notification using your currently enabled channels. iMessage is disabled in settings. Continue?",
        { modal: true },
        "Run Agent-Stop Test",
      );
      if (confirmation !== "Run Agent-Stop Test") {
        return;
      }
      await notify(context);
    }),
  );
}

export function deactivate(): void {
  for (const sound of activeSounds) {
    sound.kill();
  }
}
