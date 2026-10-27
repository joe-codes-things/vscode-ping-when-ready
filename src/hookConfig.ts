import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

const hookFileName = "ping-when-ready.json";

type HookCommand = {
  type: "command";
  exec: string;
  args: string[];
  matcher?: string;
};

type HookConfiguration = {
  version: 1;
  hooks: Record<string, unknown[]>;
  [key: string]: unknown;
};

function hookConfigurationPath(): string {
  const copilotHome = process.env.COPILOT_HOME ?? path.join(os.homedir(), ".copilot");
  return path.join(copilotHome, "hooks", hookFileName);
}

function createHook(extensionPath: string, args: string[], matcher?: string): HookCommand {
  const hook: HookCommand = {
    type: "command",
    exec: "/bin/sh",
    args: [path.join(extensionPath, "scripts", "copilot-agent-stop.sh"), ...args],
  };
  if (matcher) {
    hook.matcher = matcher;
  }
  return hook;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPingWhenReadyHook(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Partial<HookCommand>;
  return candidate.type === "command" &&
    candidate.exec === "/bin/sh" &&
    Array.isArray(candidate.args) &&
    candidate.args.length >= 1 &&
    typeof candidate.args[0] === "string" &&
    path.basename(candidate.args[0]) === "copilot-agent-stop.sh";
}

async function readHookConfiguration(filePath: string): Promise<HookConfiguration> {
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(filePath, "utf8"));
    if (
      !isRecord(parsed) ||
      parsed.version !== 1 ||
      !isRecord(parsed.hooks) ||
      !Object.values(parsed.hooks).every(Array.isArray)
    ) {
      throw new Error(`Unsupported Copilot hook configuration in ${filePath}.`);
    }
    return parsed as HookConfiguration;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { version: 1, hooks: {} };
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && typeof error.code === "string";
}

async function writeHookConfiguration(filePath: string, config: HookConfiguration): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    await fs.rename(temporaryPath, filePath);
    await fs.chmod(filePath, 0o600);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function installCopilotHook(
  extensionPath: string,
  signalFilePath: string,
): Promise<string> {
  const filePath = hookConfigurationPath();
  const config = await readHookConfiguration(filePath);
  const hookEntries = [
    {
      event: "agentStop",
      hook: createHook(extensionPath, ["agent-stop", signalFilePath]),
    },
    {
      event: "sessionStart",
      hook: createHook(extensionPath, ["session-start"]),
    },
    {
      event: "preToolUse",
      hook: createHook(extensionPath, ["question-prompt", signalFilePath], "ask_user"),
    },
  ];
  for (const { event, hook } of hookEntries) {
    const hooks = config.hooks[event] ?? [];
    config.hooks[event] = [
      ...hooks.filter((existing) => !isPingWhenReadyHook(existing)),
      hook,
    ];
  }

  await writeHookConfiguration(filePath, config);
  return filePath;
}

export async function uninstallCopilotHook(): Promise<string> {
  const filePath = hookConfigurationPath();
  const config = await readHookConfiguration(filePath);
  for (const event of ["agentStop", "sessionStart", "preToolUse"]) {
    const hooks = config.hooks[event];
    if (hooks) {
      config.hooks[event] = hooks.filter((hook) => !isPingWhenReadyHook(hook));
      if (config.hooks[event].length === 0) {
        delete config.hooks[event];
      }
    }
  }

  if (Object.keys(config.hooks).length === 0) {
    await fs.rm(filePath, { force: true });
  } else {
    await writeHookConfiguration(filePath, config);
  }
  return filePath;
}
