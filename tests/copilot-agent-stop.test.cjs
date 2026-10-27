const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require("node:fs");
const childProcess = require("node:child_process");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const hookScript = path.join(__dirname, "..", "scripts", "copilot-agent-stop.sh");
const hookConfigModule = path.join(__dirname, "..", "src", "hookConfig.ts");
const responseCategoryModule = path.join(__dirname, "..", "src", "responseCategory.ts");

test("agent-stop hook preserves the event payload for transcript classification", (t) => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-"));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  const signalPath = path.join(workspace, "agent-stop.signal");
  const transcriptPath = path.join(workspace, "transcript.jsonl");
  const event = JSON.stringify({ hook_event_name: "agentStop", transcriptPath });
  const firstOutput = execFileSync("/bin/sh", [hookScript, "agent-stop", signalPath], {
    cwd: workspace,
    encoding: "utf8",
    input: event,
  });
  const firstSignal = readFileSync(signalPath, "utf8");
  assert.equal(firstSignal, event);

  const secondOutput = execFileSync("/bin/sh", [hookScript, "agent-stop", signalPath], {
    cwd: workspace,
    encoding: "utf8",
    input: event,
  });

  assert.equal(firstOutput.trim(), "{}");
  assert.equal(secondOutput.trim(), "{}");
  assert.equal(firstSignal, event);
});

test("question-prompt hook forwards its event in a private signal for local extraction", (t) => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-question-"));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  const signalPath = path.join(workspace, "agent-stop.signal");
  const output = execFileSync("/bin/sh", [hookScript, "question-prompt", signalPath], {
    cwd: workspace,
    encoding: "utf8",
    input: JSON.stringify({ toolName: "ask_user", toolArgs: { question: "Private question text" } }),
  });
  const signal = readFileSync(signalPath, "utf8");
  const parsedSignal = JSON.parse(signal);

  assert.equal(output.trim(), "{}");
  assert.equal(parsedSignal.hookEventName, "pingWhenReadyQuestionPrompt");
  assert.equal(parsedSignal.event.toolArgs.question, "Private question text");
  assert.equal(parsedSignal.event.toolName, "ask_user");
  assert.equal(statSync(signalPath).mode & 0o777, 0o600);
});

test("session-start hook adds the question-marker instruction to agent context", () => {
  const output = execFileSync("/bin/sh", [hookScript, "session-start"], { encoding: "utf8" });
  const result = JSON.parse(output);
  assert.equal(result.hookSpecificOutput.hookEventName, "SessionStart");
  assert.match(result.hookSpecificOutput.additionalContext, /<!-- ping-when-ready:question -->/);
  assert.match(result.hookSpecificOutput.additionalContext, /If uncertain, omit it/);
});

test("hook installation preserves other user hooks and can be removed", async (t) => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-config-"));
  const previousCopilotHome = process.env.COPILOT_HOME;
  process.env.COPILOT_HOME = path.join(temporaryRoot, "copilot-home");
  t.after(() => {
    if (previousCopilotHome === undefined) {
      delete process.env.COPILOT_HOME;
    } else {
      process.env.COPILOT_HOME = previousCopilotHome;
    }
    rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const modulePath = path.join(temporaryRoot, "hookConfig.cjs");
  esbuild.buildSync({
    entryPoints: [hookConfigModule],
    outfile: modulePath,
    bundle: true,
    platform: "node",
    format: "cjs",
  });
  const { installCopilotHook, uninstallCopilotHook } = require(modulePath);
  const extensionPath = path.join(temporaryRoot, "extension");
  const signalFilePath = path.join(temporaryRoot, "signal", "agent-stop.signal");
  const configPath = path.join(process.env.COPILOT_HOME, "hooks", "ping-when-ready.json");
  const unrelatedHook = { type: "command", exec: "/bin/echo", args: ["keep"] };
  mkdirSync(path.dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify({
    version: 1,
    hooks: {
      agentStop: [unrelatedHook],
      sessionStart: [unrelatedHook],
      preToolUse: [unrelatedHook],
    },
  }));

  await installCopilotHook(extensionPath, signalFilePath);
  await installCopilotHook(extensionPath, signalFilePath);
  const installed = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(installed.hooks.agentStop.length, 2);
  assert.deepEqual(installed.hooks.agentStop[0], unrelatedHook);
  assert.deepEqual(installed.hooks.agentStop[1], {
    type: "command",
    exec: "/bin/sh",
    args: [path.join(extensionPath, "scripts", "copilot-agent-stop.sh"), "agent-stop", signalFilePath],
  });
  assert.deepEqual(installed.hooks.sessionStart, [
    unrelatedHook,
    {
      type: "command",
      exec: "/bin/sh",
      args: [path.join(extensionPath, "scripts", "copilot-agent-stop.sh"), "session-start"],
    },
  ]);
  assert.deepEqual(installed.hooks.preToolUse, [
    unrelatedHook,
    {
      type: "command",
      exec: "/bin/sh",
      args: [path.join(extensionPath, "scripts", "copilot-agent-stop.sh"), "question-prompt", signalFilePath],
      matcher: "ask_user",
    },
  ]);

  await uninstallCopilotHook();
  const uninstalled = JSON.parse(readFileSync(configPath, "utf8"));
  assert.deepEqual(uninstalled.hooks, {
    agentStop: [unrelatedHook],
    sessionStart: [unrelatedHook],
    preToolUse: [unrelatedHook],
  });
});

test("question marker classification uses only the final assistant message", async (t) => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-transcript-"));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

  const modulePath = path.join(temporaryRoot, "responseCategory.cjs");
  esbuild.buildSync({
    entryPoints: [responseCategoryModule],
    outfile: modulePath,
    bundle: true,
    platform: "node",
    format: "cjs",
  });
  const {
    extractQuestionText,
    finalAssistantResponse,
    responseHasQuestionMarker,
    summarizeText,
  } = require(modulePath);
  const transcriptPath = path.join(temporaryRoot, "session.jsonl");
  const entry = (type, content) => JSON.stringify({ type, data: { content } });

  writeFileSync(transcriptPath, [
    entry("assistant.message", "Do you prefer option A? <!-- ping-when-ready:question -->"),
    entry("user.message", "The marker from an old response may appear in transcript history."),
    entry("assistant.message", "Agent response ready for review."),
  ].join("\n"));
  let response = await finalAssistantResponse(transcriptPath);
  assert.equal(responseHasQuestionMarker(response), false);
  assert.equal(summarizeText(response), "Agent response ready for review.");

  writeFileSync(transcriptPath, [
    entry("assistant.message", "The answer is ready."),
    entry("assistant.message", "Should I proceed? <!-- ping-when-ready:question -->"),
    entry("assistant.turn_end", ""),
  ].join("\n"));
  response = await finalAssistantResponse(transcriptPath);
  assert.equal(responseHasQuestionMarker(response), true);
  assert.equal(summarizeText(response), "Should I proceed?");

  writeFileSync(transcriptPath, entry(
    "assistant.message",
    "This explains the marker <!-- ping-when-ready:question --> but is not marked as a question.",
  ));
  response = await finalAssistantResponse(transcriptPath);
  assert.equal(responseHasQuestionMarker(response), false);
  assert.equal(summarizeText(response), "This explains the marker but is not marked as a question.");

  assert.equal(extractQuestionText({ question: "Which language should we use?", choices: ["A", "B"] }), "Which language should we use?");
  assert.equal(extractQuestionText({ question: `${"A".repeat(200)}?` }).length, 120);
  assert.equal(extractQuestionText({ options: ["A", "B"] }), undefined);
  assert.equal(summarizeText("## Summary\n\nSecond paragraph is longer."), "Summary");
});

test("settings sidebar checkboxes reflect and update global notification settings", async (t) => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-settings-"));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

  const modulePath = path.join(temporaryRoot, "settingsView.cjs");
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "src", "settingsView.ts")],
    outfile: modulePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
  });

  const values = new Map([
    ["notifications.macOS", true],
    ["notifications.sound", false],
    ["notifications.iMessage", false],
    ["notifications.includeSummary", true],
  ]);
  const changeListeners = [];
  class EventEmitter {
    event(listener) {
      changeListeners.push(listener);
      return { dispose() {} };
    }
    fire(value) {
      for (const listener of changeListeners) listener(value);
    }
    dispose() {}
  }
  class TreeItem {
    constructor(label) {
      this.label = label;
    }
  }
  const vscodeMock = {
    EventEmitter,
    TreeItem,
    TreeItemCheckboxState: { Unchecked: 0, Checked: 1 },
    ConfigurationTarget: { Global: 1 },
    workspace: {
      getConfiguration: () => ({
        get: (key, fallback) => values.get(key) ?? fallback,
        update: async (key, value, target) => {
          assert.equal(target, 1);
          values.set(key, value);
        },
      }),
    },
  };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    return request === "vscode" ? vscodeMock : originalLoad.call(this, request, parent, isMain);
  };

  try {
    const { SettingsTreeDataProvider } = require(modulePath);
    const provider = new SettingsTreeDataProvider();
    const items = provider.getChildren();
    assert.deepEqual(items.map((item) => item.label), [
      "macOS Notifications",
      "Sound",
      "iMessage",
      "Include Summary",
      "Choose Sound File…",
      "Set iMessage Recipient…",
    ]);

    assert.equal(provider.getTreeItem(items[0]).checkboxState, 1);
    assert.equal(provider.getTreeItem(items[1]).checkboxState, 0);
    await provider.setChecked(items[1], true);
    assert.equal(values.get("notifications.sound"), true);
    assert.equal(provider.getTreeItem(items[1]).checkboxState, 1);
    assert.equal(provider.getTreeItem(items[4]).command.command, "pingWhenReady.openSoundSetting");
    assert.equal(provider.getTreeItem(items[5]).command.command, "pingWhenReady.setIMessageRecipient");
    provider.dispose();
  } finally {
    Module._load = originalLoad;
  }
});

test("iMessage recipient is stored securely and send test commands require confirmation", async (t) => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-extension-"));
  t.after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

  const extensionBundle = path.join(temporaryRoot, "extension.cjs");
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, "..", "src", "extension.ts")],
    outfile: extensionBundle,
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
  });

  const registeredCommands = new Map();
  const outputLines = [];
  const secretStorage = new Map();
  const recipient = "+14155550123";
  const scriptCalls = [];
  let signalCreated;
  let confirmationResponse;
  const settings = {
    "pingWhenReady.notifications.macOS": false,
    "pingWhenReady.notifications.sound": false,
    "pingWhenReady.notifications.iMessage": true,
  };
  const vscodeMock = {
    window: {
      createOutputChannel: () => ({ appendLine: (line) => outputLines.push(line), dispose() {} }),
      showErrorMessage() {},
      showInformationMessage() {},
      showWarningMessage: async (message) => {
        warningMessages.push(message);
        return confirmationResponse;
      },
      showInputBox: async () => recipient,
    },
    workspace: {
      getConfiguration: () => ({
        get: (key, fallback) => settings[`pingWhenReady.${key}`] ?? fallback,
      }),
      createFileSystemWatcher: () => ({
        onDidCreate: (listener) => { signalCreated = listener; },
        onDidChange() {},
        dispose() {},
      }),
      onDidChangeConfiguration: () => ({ dispose() {} }),
    },
    RelativePattern: class {},
    SecretStorage: class {},
    commands: {
      registerCommand: (name, handler) => {
        registeredCommands.set(name, handler);
        return { dispose() {} };
      },
    },
  };
  vscodeMock.window.createTreeView = (viewId, options) => {
    treeViewHandlers.viewId = viewId;
    treeViewHandlers.provider = options.treeDataProvider;
    return {
      onDidChangeCheckboxState: (listener) => { treeViewHandlers.checkboxListener = listener; },
      dispose() {},
    };
  };
  vscodeMock.TreeItemCheckboxState = { Unchecked: 0, Checked: 1 };
  vscodeMock.ConfigurationTarget = { Global: 1 };
  vscodeMock.EventEmitter = class {
    event() { return { dispose() {} }; }
    fire() {}
    dispose() {}
  };
  vscodeMock.TreeItem = class {
    constructor(label) { this.label = label; }
  };
  const warningMessages = [];
  const treeViewHandlers = {};
  const originalLoad = Module._load;
  const originalExecFile = childProcess.execFile;
  childProcess.execFile = (file, args, options, callback) => {
    scriptCalls.push({ file, args, options });
    callback(null, "", "");
    return {};
  };
  Module._load = function (request, parent, isMain) {
    return request === "vscode" ? vscodeMock : originalLoad.call(this, request, parent, isMain);
  };

  try {
    const extension = require(extensionBundle);
    await extension.activate({
      extensionPath: temporaryRoot,
      globalStorageUri: { fsPath: path.join(temporaryRoot, "storage") },
      subscriptions: [],
      secrets: {
        get: async (key) => secretStorage.get(key),
        store: async (key, value) => secretStorage.set(key, value),
      },
    });
    assert.equal(treeViewHandlers.viewId, "pingWhenReady.settings");
    assert.equal(treeViewHandlers.provider.getChildren().length, 6);
  } finally {
    Module._load = originalLoad;
    childProcess.execFile = originalExecFile;
  }

  await registeredCommands.get("pingWhenReady.setIMessageRecipient")();
  assert.equal(secretStorage.get("pingWhenReady.iMessageRecipient"), recipient);

  await registeredCommands.get("pingWhenReady.sendTestIMessage")();
  assert.equal(scriptCalls.length, 0);

  confirmationResponse = "Send Test iMessage";
  await registeredCommands.get("pingWhenReady.sendTestIMessage")();
  assert.equal(scriptCalls.length, 1);
  assert.equal(scriptCalls[0].file, "/usr/bin/osascript");
  assert.equal(scriptCalls[0].args[0], "-e");
  assert.match(scriptCalls[0].args[1], /whose service type is iMessage/);
  assert.deepEqual(scriptCalls[0].args.slice(2), [recipient, "Ping When Ready test message."]);
  assert.equal(scriptCalls[0].options.timeout, 30_000);
  assert.equal(outputLines.some((line) => line.includes(recipient)), false);

  confirmationResponse = undefined;
  await registeredCommands.get("pingWhenReady.testAgentStopNotification")();
  assert.equal(scriptCalls.length, 1);

  confirmationResponse = "Run Agent-Stop Test";
  await registeredCommands.get("pingWhenReady.testAgentStopNotification")();
  assert.equal(scriptCalls.length, 2);
  assert.deepEqual(scriptCalls[1].args.slice(2), [recipient, "Agent response ready for review."]);
  assert.match(warningMessages.at(-1), /sends a real iMessage/);

  const transcriptPath = path.join(temporaryRoot, "session.jsonl");
  writeFileSync(transcriptPath, JSON.stringify({
    type: "assistant.message",
    data: { content: `Could you answer this? ${"<!-- ping-when-ready:question -->"}` },
  }));
  const signalPath = path.join(temporaryRoot, "storage", "agent-stop.signal");
  writeFileSync(signalPath, JSON.stringify({ transcriptPath }));
  await signalCreated({ fsPath: signalPath });
  for (let attempt = 0; attempt < 100 && scriptCalls.length < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(scriptCalls.length, 3, outputLines.join("\n"));
  assert.deepEqual(scriptCalls[2].args.slice(2), [recipient, "Question from agent: Could you answer this?"]);

  writeFileSync(transcriptPath, JSON.stringify({
    type: "assistant.message",
    data: { content: "The task is complete." },
  }));
  writeFileSync(signalPath, JSON.stringify({ transcriptPath, timestamp: "later" }));
  await signalCreated({ fsPath: signalPath });
  for (let attempt = 0; attempt < 100 && scriptCalls.length < 4; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(scriptCalls.length, 4, outputLines.join("\n"));
  assert.deepEqual(scriptCalls[3].args.slice(2), [recipient, "Agent response: The task is complete."]);

  writeFileSync(signalPath, JSON.stringify({
    hookEventName: "pingWhenReadyQuestionPrompt",
    timestamp: "later-still",
  }));
  await signalCreated({ fsPath: signalPath });
  for (let attempt = 0; attempt < 100 && scriptCalls.length < 5; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(scriptCalls.length, 5, outputLines.join("\n"));
  assert.deepEqual(scriptCalls[4].args.slice(2), [recipient, "Question from agent pending."]);
  assert.match(outputLines.at(-2), /Received Copilot question-prompt signal/);

  writeFileSync(signalPath, JSON.stringify({
    hookEventName: "pingWhenReadyQuestionPrompt",
    timestamp: "later-still-again",
    event: { toolName: "ask_user", toolArgs: { question: "Which language should we use next?" } },
  }));
  await signalCreated({ fsPath: signalPath });
  for (let attempt = 0; attempt < 100 && scriptCalls.length < 6; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(scriptCalls.length, 6, outputLines.join("\n"));
  assert.deepEqual(scriptCalls[5].args.slice(2), [
    recipient,
    "Question from agent: Which language should we use next?",
  ]);
  assert.equal(require("node:fs").existsSync(signalPath), false);

  settings["pingWhenReady.notifications.includeSummary"] = false;
  writeFileSync(transcriptPath, JSON.stringify({
    type: "assistant.message",
    data: { content: "The private summary should not be included." },
  }));
  writeFileSync(signalPath, JSON.stringify({ transcriptPath, timestamp: "generic-only" }));
  await signalCreated({ fsPath: signalPath });
  for (let attempt = 0; attempt < 100 && scriptCalls.length < 7; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(scriptCalls.length, 7, outputLines.join("\n"));
  assert.deepEqual(scriptCalls[6].args.slice(2), [recipient, "Agent response ready for review."]);
  assert.equal(require("node:fs").existsSync(signalPath), false);
});
