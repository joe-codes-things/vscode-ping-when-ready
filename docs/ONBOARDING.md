# Project Onboarding

## Project overview

This repository contains a personal, macOS-focused VS Code extension for
notifying the user when a GitHub Copilot agent finishes a turn. It uses
Copilot's `agentStop` hook and supports a native macOS notification, optional
sound, and an optional macOS Shortcut for iMessage. The extension is an early
prototype; `agentStop` has been confirmed to trigger a notification in the
user's VS Code installation, but broader reliability and optional channels
still need validation.

## Architecture at a glance

- `src/extension.ts` implements the VS Code extension and notification
  channels.
- `src/hookConfig.ts` installs/removes the user-level Copilot hook while
  preserving other configured hooks.
- `scripts/copilot-agent-stop.sh` writes a unique signal to VS Code extension
  global storage. The extension watches this path to receive hook events.
- `package.json`, `tsconfig.json`, and `.vscode/` configure compilation,
  type-checking, tests, packaging, and launching the Extension Development
  Host.
- `tests/copilot-agent-stop.test.cjs` checks the shell signal and hook
  configuration management.
- The intended audience is the project owner. Public extension distribution is
  not a goal.
- `README.md` is the concise project entry point.
- `docs/BUGS.md` tracks reported issues, and `docs/FEATURE-IDEAS.md` tracks
  design questions and potential behavior.

## Getting familiar with the project

Start with `README.md` for setup. Press F5 to open the Extension Development
Host; enable the hook there and start a new Copilot-targeted session. The
**Test Signal Bridge** command checks the file handoff separately from
Copilot's hook event.

## Development and research environment

The extension uses TypeScript, Node.js in the local/UI extension host, esbuild,
and the VS Code Extension API. It is currently macOS-only. Run
`npm run check-types`, `npm test`, and `npm run package` to validate it.

## Initial development direction

The implementation uses a user-level Copilot `agentStop` command hook and an
extension-global-storage signal file. In the user's VS Code installation, the
Copilot stop hook successfully triggered a notification after the initial
working-directory handoff was corrected to use extension global storage.
Continue validating timing and duplicate behavior in normal sessions because
VS Code documents hooks as a Preview feature.

## Research findings (2026-10-24)

### Detecting a completed agent response

The stable VS Code Extension API does not expose a general event for observing
the end of a response written by Copilot Chat or another extension's agent.
The Chat Participant API is for an extension's own participant and its own
response handler; it is not a listener for other participants' replies. The
current VS Code Chat Participants guide also marks that API deprecated and
not supported in the Copilot harness.

The Language Model API lets an extension make its own model request, not
subscribe to another chat's response. A language-model tool can be called by
an agent during a turn, but tool invocation does not mean the assistant's
written response is finished; the tool may not be called, or the agent may
continue afterward. Do not infer completion by inspecting whether a reply
ends in a question: the desired trigger is the end of the completed assistant
turn, regardless of whether it ends with a statement or a question.

#### Preferred Copilot integration: agent stop hook

Current VS Code documentation describes agent hooks, which run actions at
agent lifecycle points without relying on the model to request an action. The
Copilot hook event `agentStop` checks whether the agent should finish its
turn. This is a promising signal near the end of a response, including
responses that end in a question, but it is not documented as a post-render
notification event. A stop attempt can be retried if an agent is asked to
continue. VS Code's hook experience is currently in Preview, so validate
timing, duplicate behavior, and the session target/version used before
treating it as reliable.

The hook uses a unique signal in extension global storage rather than the
Copilot hook process's working directory. This avoids requiring the extension
and hook to share a workspace and supports workspaces whose files are not
directly involved. The signal contains no chat text or personal data.

### Visual notification

The native macOS banner is implemented by invoking `osascript` with Apple's
Standard Additions `display notification` command. The user confirmed that
the test notification displayed successfully on their Mac. The VS Code
in-workbench message API is used for setup and error feedback, not as a
substitute for the native banner.

Apple documents the Standard Additions AppleScript `display notification`
command as a way to show Notification Center banners or alerts, according to
the user's macOS notification settings. A macOS-only prototype can invoke
`osascript` from the local Node.js extension host with a fixed script and
separate arguments; do not build a shell command from notification text or
settings. Validate the banner style and which application name macOS displays
for this invocation on the target Mac. This is a macOS integration, not a
portable VS Code API. The user prefers this native macOS banner style, so
treat it as the target visual channel. Optionally offer the VS Code in-app
message as a separate channel.

### Settings and notification channels

Preferences are contributed through `contributes.configuration`. Separate
boolean settings allow channels to be enabled together. The native macOS
banner is enabled by default; sound and iMessage are disabled by default.
Sound currently uses an absolute path to a local WAV or MP3 file; the user
plans to provide candidate sounds later. iMessage uses a configurable
Shortcut name.

### Sound playback

The VS Code API has no general audio-playback function. The current
macOS-only implementation uses the local Node.js extension host to spawn
`afplay` with the configured sound path. It uses an argument array rather
than constructing a shell command from settings. Audio files are not bundled
yet; the user plans to provide candidate WAV or MP3 files.

The `afplay` usage information checked does not promise a definitive codec
list, so validate both WAV and MP3 assets on the supported macOS version
before claiming compatibility. A small tested set of WAV or AIFF sounds could
avoid adding a decoder dependency. Ensure the extension runs on the local/UI
host, not only a remote host, so audio plays on the Mac. Check licenses for
any sound assets supplied or packaged.

### Optional iMessage notification

VS Code has no iMessage API. The current optional integration invokes a
user-created macOS Shortcut by name through Apple's `shortcuts` command-line
tool. The user must configure its Send Message action and recipient in
Shortcuts; the extension does not store the phone number. This remains
unvalidated and is disabled by default.

Keep this channel opt-in and off by default, and send a generic completion
notice rather than chat contents. Never use undocumented Messages databases
or try to bypass macOS consent. A gitignored text file is only protected from
accidental Git commits; it is not encrypted. The current design keeps the
recipient in the user's Shortcut so the extension never stores it.

#### Feasibility refresh (2026-10-25)

For a single recipient and fixed completion message, a user-created Shortcut
remains the simplest first implementation to validate. Apple documents
running a named Shortcut using `shortcuts run <name>` and says that a
successful run exits with code 0 and an error exits with code 1. Shortcuts
that ask for input or show alerts can pause the command-line run, so configure
the fixed recipient and generic message inside the Shortcut and avoid
interactive actions. A successful exit confirms Shortcut execution, not
delivery to the recipient.

A phone number does not guarantee iMessage routing. The Mac's Messages
configuration and recipient availability determine whether the message uses
iMessage or another Messages route, including SMS/MMS/RCS when configured.
Before enabling automatic sends, manually run the Shortcut and verify the
resulting conversation and message route in Messages.

AppleScript/JXA can automate Messages on this Mac, and the installed Messages
application includes a scripting dictionary. However, that dictionary is not
a documented, stable public send API for third-party extensions, and macOS
Automation consent applies. The exact app identity macOS will show for
extension-launched automation should be tested on the installed VS Code
build. Automation grants can be reviewed or revoked in System Settings;
permission persistence across OS or VS Code identity/signature changes is not
guaranteed.

No first-party Apple API was found for an unrelated VS Code extension to send
arbitrary iMessages. Apple's Messages framework is for extensions that run
inside Messages conversations, not a general desktop sender.

Existing Node packages do not improve on the Shortcut approach for this
prototype:

- [`osa-imessage`](https://github.com/wtfaremyinitials/osa-imessage) advertises
  AppleScript-backed sending, but the npm release is version 2.4.2 and its
  registry metadata was last modified in 2022. Treat modern macOS support as
  unverified; it is a wrapper around automation, not an Apple messaging API.
- [`imessage`](https://github.com/nicola/node-imessage) is read-only and
  accesses local Messages data; it does not send messages.
- [`imessage-exporter`](https://github.com/ReagentX/imessage-exporter) exports
  Messages history and is not a sender. Its GPL-3.0 license and history-data
  access are unnecessary for this feature.
- [`run-applescript`](https://github.com/sindresorhus/run-applescript) is a
  maintained generic AppleScript wrapper, not an iMessage library. The
  extension already has Node's `execFile`, so another dependency is not
  needed.

#### Recommendation and safeguards

Retain the current Shortcut approach, with the recipient and fixed text stored
in the user's Shortcut rather than source code, settings, hook arguments, or
logs. `.gitignore` is not secure storage; VS Code `SecretStorage` would be
appropriate only if the extension itself must retain the recipient. The
extension currently stores only the Shortcut's name and invokes
`/usr/bin/shortcuts` using Node's `execFile` with separate arguments, avoiding
shell interpolation.

Keep iMessage disabled by default and clearly explain that enabling it sends
a real message. Currently, **Send Test Notification** also runs the configured
Shortcut when the iMessage setting is enabled; it can send a real message and
must not be treated as a harmless local test. Test the Shortcut manually
first. Before adding an explicit test-send action, show a confirmation that
clearly states it sends an actual message. Add a timeout for shortcuts that
pause awaiting input, report command/permission errors without logging the
recipient or message body, and never describe exit code 0 as proof of message
delivery. Verify delivery and routing manually in Messages.

macOS Automation permissions can be reviewed and revoked in System Settings.
Apple's public docs do not promise that permission will persist indefinitely
through changes to macOS, the VS Code installation, or app identity/signing.
If using AppleScript/JXA directly, first confirm which app macOS identifies as
the automation requester on the installed VS Code build.

### Sources

- [VS Code API reference](https://code.visualstudio.com/api/references/vscode-api)
- [VS Code Chat Participants guide](https://code.visualstudio.com/api/extension-guides/ai/chat)
- [VS Code Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)
- [VS Code Language Model Tool API guide](https://code.visualstudio.com/api/extension-guides/ai/tools)
- [VS Code agent hooks guide (Preview)](https://code.visualstudio.com/docs/agent-customization/hooks)
- [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)
- [VS Code custom instructions guide](https://code.visualstudio.com/docs/agent-customization/custom-instructions)
- [VS Code `FileSystemWatcher` API](https://code.visualstudio.com/api/references/vscode-api#workspace.createFileSystemWatcher)
- [VS Code contribution points: configuration](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration)
- [VS Code Settings](https://code.visualstudio.com/docs/configure/settings)
- [VS Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [VS Code web extensions](https://code.visualstudio.com/api/extension-guides/web-extensions)
- [VS Code webview guidance](https://code.visualstudio.com/api/extension-guides/webview)
- [macOS `afplay` manual](https://manp.gs/mac/1/afplay)
- [Apple: Displaying notifications from scripts](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/DisplayNotifications.html)
- [macOS `osascript` manual](https://manp.gs/mac/1/osascript)
- [Apple: Run shortcuts from the command line](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac)
- [Apple: Shortcuts actions](https://support.apple.com/guide/shortcuts-mac/intro-to-shortcuts-apdf22b0444c/10.0/mac/27)
- [Apple: Allow apps to automate and control other apps](https://support.apple.com/guide/mac-help/allow-apps-to-automate-and-control-other-apps-mchl108e1718/mac)
- [Apple: Send a message on Mac](https://support.apple.com/guide/messages/send-messages-icht35827/26.0/mac/27)
- [Apple: Messages on Mac](https://support.apple.com/guide/messages/welcome/mac)
- [Apple: Forward SMS/MMS/RCS messages from iPhone to Mac](https://support.apple.com/en-us/102545)
- [Apple: Limit shortcut input and avoid unnecessary prompts](https://support.apple.com/guide/shortcuts-mac/limit-the-input-for-a-shortcut-when-run-from-another-app-apd8195f96d6/mac)
- [Apple: Messages framework](https://developer.apple.com/documentation/messages.md)
- [Apple: `NSAppleEventsUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nsappleeventsusagedescription.md)
- [Apple: Automation settings on Mac](https://support.apple.com/guide/mac-help/allow-apps-to-automate-and-control-other-apps-mchl108e1718/mac)
- [`osa-imessage` npm registry](https://registry.npmjs.org/osa-imessage)
- [`imessage` npm registry](https://registry.npmjs.org/imessage)
- [`run-applescript` npm package](https://www.npmjs.com/package/run-applescript)
- [`imessage-exporter` project](https://github.com/ReagentX/imessage-exporter)
- [Node.js `child_process.execFile`](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback)
- [Apple: Notifications settings on Mac](https://support.apple.com/guide/mac-help/notifications-settings-mh40583/mac)

### Local validation

- The user confirmed that **Send Test Notification** displayed a native
  notification on their Mac.
- The user confirmed that a Copilot agent stop successfully triggered a
  notification after the hook signal path was changed from the hook process's
  current working directory to the extension's global storage.
- The user confirmed that the notification now works from the agent-stop hook
  in their VS Code installation.
- Automated checks cover hook signal creation and hook configuration
  installation/removal, but do not exercise a live Copilot session or prove
  that all Copilot stop attempts correspond to completed user-visible replies.

## Distribution

The extension is intended for private, personal use, not publication as a
public Marketplace extension. Use F5 for development or build a `.vsix` for
local installation.
