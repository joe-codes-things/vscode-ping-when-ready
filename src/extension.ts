import * as childProcess from "node:child_process";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { promisify } from "node:util";
import * as vscode from "vscode";
import { installCopilotHook, uninstallCopilotHook } from "./hookConfig";

const execFile = promisify(childProcess.execFile);
const output = vscode.window.createOutputChannel("Ping When Ready");
const lastSignalByPath = new Map<string, string>();
const activeSounds = new Set<childProcess.ChildProcess>();
const signalWaiters = new Set<() => void>();
const signalFileName = "agent-stop.signal";

function setting<T>(key: string, fallback: T): T {
  return vscode.workspace.getConfiguration("pingWhenReady").get<T>(key, fallback);
}

function logError(message: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  output.appendLine(`${message}: ${detail}`);
  void vscode.window.showErrorMessage(`Ping When Ready: ${message}. See Output > Ping When Ready for details.`);
}

async function showNativeNotification(): Promise<void> {
  await execFile("/usr/bin/osascript", [
    "-e",
    "on run argv",
    "-e",
    "display notification (item 1 of argv) with title (item 2 of argv)",
    "-e",
    "end run",
    "The agent has finished responding.",
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

async function runShortcut(): Promise<void> {
  const name = setting<string>("iMessage.shortcutName", "Ping When Ready").trim();
  if (!name) {
    throw new Error("Set the name of the macOS Shortcut that sends the iMessage.");
  }
  await execFile("/usr/bin/shortcuts", ["run", name]);
}

async function notify(): Promise<void> {
  const work: Promise<void>[] = [];
  if (setting<boolean>("notifications.macOS", true)) {
    work.push(showNativeNotification());
  }
  if (setting<boolean>("notifications.sound", false)) {
    work.push(playSound());
  }
  if (setting<boolean>("notifications.iMessage", false)) {
    work.push(runShortcut());
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
      for (const waiter of [...signalWaiters]) {
        waiter();
      }
      await notify();
    } catch (error) {
      logError("Could not process the Copilot agent-stop signal", error);
    }
  };

  watcher.onDidCreate((uri) => void handleSignal(uri));
  watcher.onDidChange((uri) => void handleSignal(uri));
  context.subscriptions.push(watcher);
}

function waitForSignal(timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const waiter = (): void => {
      clearTimeout(timeout);
      signalWaiters.delete(waiter);
      resolve();
    };
    const timeout = setTimeout(() => {
      signalWaiters.delete(waiter);
      reject(new Error("The extension did not receive the test signal. Check the Ping When Ready output channel."));
    }, timeoutMs);
    signalWaiters.add(waiter);
  });
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
    vscode.commands.registerCommand("pingWhenReady.testSignalBridge", async () => {
      try {
        const signalFilePath = path.join(context.globalStorageUri.fsPath, signalFileName);
        const receivedSignal = waitForSignal(3000);
        await Promise.all([
          execFile("/bin/sh", [
            path.join(context.extensionPath, "scripts", "copilot-agent-stop.sh"),
            signalFilePath,
          ]),
          receivedSignal,
        ]);
        output.appendLine("The extension received its test signal. Copilot's agentStop event was not tested.");
        vscode.window.showInformationMessage("Signal bridge passed; the extension received the test signal. Copilot's agentStop event was not tested.");
      } catch (error) {
        logError("Could not run the signal bridge test", error);
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
    vscode.commands.registerCommand("pingWhenReady.sendTestNotification", async () => {
      await notify();
    }),
  );
}

export function deactivate(): void {
  for (const sound of activeSounds) {
    sound.kill();
  }
}
