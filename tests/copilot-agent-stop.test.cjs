const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const esbuild = require("esbuild");

const hookScript = path.join(__dirname, "..", "scripts", "copilot-agent-stop.sh");
const hookConfigModule = path.join(__dirname, "..", "src", "hookConfig.ts");

test("agent-stop hook writes a fresh signal and returns a no-op decision", (t) => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "ping-when-ready-"));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));

  const signalPath = path.join(workspace, "agent-stop.signal");
  const firstOutput = execFileSync("/bin/sh", [hookScript, signalPath], {
    cwd: workspace,
    encoding: "utf8",
    input: '{"hook_event_name":"agentStop"}',
  });
  const firstSignal = readFileSync(signalPath, "utf8").trim();

  const secondOutput = execFileSync("/bin/sh", [hookScript, signalPath], {
    cwd: workspace,
    encoding: "utf8",
    input: '{"hook_event_name":"agentStop"}',
  });
  const secondSignal = readFileSync(signalPath, "utf8").trim();

  assert.equal(firstOutput.trim(), "{}");
  assert.equal(secondOutput.trim(), "{}");
  assert.match(firstSignal, /^\d+:\d+$/);
  assert.match(secondSignal, /^\d+:\d+$/);
  assert.notEqual(firstSignal, secondSignal);
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
    hooks: { agentStop: [unrelatedHook], sessionStart: [unrelatedHook] },
  }));

  await installCopilotHook(extensionPath, signalFilePath);
  await installCopilotHook(extensionPath, signalFilePath);
  const installed = JSON.parse(readFileSync(configPath, "utf8"));

  assert.equal(installed.hooks.agentStop.length, 2);
  assert.deepEqual(installed.hooks.agentStop[0], unrelatedHook);
  assert.deepEqual(installed.hooks.agentStop[1], {
    type: "command",
    exec: "/bin/sh",
    args: [path.join(extensionPath, "scripts", "copilot-agent-stop.sh"), signalFilePath],
  });
  assert.deepEqual(installed.hooks.sessionStart, [unrelatedHook]);

  await uninstallCopilotHook();
  const uninstalled = JSON.parse(readFileSync(configPath, "utf8"));
  assert.deepEqual(uninstalled.hooks, {
    agentStop: [unrelatedHook],
    sessionStart: [unrelatedHook],
  });
});
