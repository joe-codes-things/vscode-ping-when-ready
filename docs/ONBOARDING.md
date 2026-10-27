# Project Onboarding

## Project overview

This repository contains a personal, macOS-focused VS Code extension for
notifying the user when a GitHub Copilot agent asks for input or finishes a
turn. It uses Copilot's `preToolUse` hook matched to `ask_user` for interactive
question prompts and `agentStop` for completed turns. It supports a native
macOS notification, optional sound, and optional AppleScript automation of
Messages for iMessage. The user has confirmed both prompt-time and
follow-up-completion notifications in a live Extension Development Host
session. Copilot hooks are in Preview; broader reliability and optional
channels still need validation.

## Architecture at a glance

- `src/extension.ts` implements the VS Code extension and notification
  channels.
- `src/hookConfig.ts` installs/removes the user-level Copilot hooks while
  preserving other configured hooks.
- `scripts/copilot-agent-stop.sh` injects the question-marker direction at
  session start, writes agent-stop payloads, and writes question-prompt event
  payloads for the `ask_user` tool to extension global storage.
- `src/responseCategory.ts` reads the final assistant transcript entry,
  classifies marked questions, and extracts bounded local summaries.
- `package.json`, `tsconfig.json`, and `.vscode/` configure compilation,
  type-checking, tests, packaging, and launching the Extension Development
  Host.
- `tests/copilot-agent-stop.test.cjs` checks the shell signal and hook
  configuration management.
- `src/settingsView.ts` supplies the Activity Bar view with live notification
  toggles and shortcuts to detailed settings.
- `resources/icon.png` uses the supplied red bell artwork for the extension
  icon, and `resources/ping.svg` provides its Activity Bar counterpart. The
  source artwork archive is kept in `user-interface/` and excluded from the
  VSIX package.
- The intended audience is the project owner. Public extension distribution is
  not a goal.
- `README.md` is the concise project entry point.
- `docs/BUGS.md` tracks reported issues, and `docs/FEATURE-IDEAS.md` tracks
  design questions and potential behavior.

## Repository folders

- `.github/` and `.githooks/` are local/automation configuration directories
  ignored by Git.
- `.vscode/` contains VS Code development-host launch configuration.
- `artifacts/` and `dist/` contain generated packages and compiled output;
  both are ignored by Git.
- `docs/` contains project documentation.
- `node_modules/` contains installed dependencies and is ignored by Git.
- `resources/` contains the extension's runtime icons.
- `scripts/` contains the local Copilot hook script.
- `sound-fx/` is reserved for local sound files and samples and is entirely
  ignored by Git and excluded from VSIX packages; do not expect its contents in
  a checkout, package, or public repository.
- `src/` contains the extension implementation, and `tests/` contains its tests.
- `user-interface/` contains the tracked source archive for the extension icon;
  runtime icon files are kept in `resources/`.

## Getting familiar with the project

Start with `README.md` for setup. Press F5 to open the Extension Development
Host; enable or update the hooks there and start a new Copilot-targeted
session. In a regular VS Code window, use the Ping When Ready icon in the
Activity Bar to toggle notification channels without searching the full
Settings UI; the view's gear opens the filtered extension settings.

## Audio playback investigation

For the reported sound-doubling/distortion issue, follow the project-wide
instructions in `AGENTS.md` and the current evidence in
[B002](./BUGS.md#b002--notification-sound-appears-doubled-and-distorted-during-playback).
The user is a professional music producer and has already checked the exported
sounds in a DAW, where the reported artifact was not present. Treat the
extension-playback report as credible; investigate event duplication,
concurrent playback processes, and the macOS output path. Do not presume a
mixing, clipping, export, or user-error problem, or ask the user to repeat
audio-quality checks they have already performed.

Hook signals now carry unique IDs and are claimed through exclusive file
creation in extension global storage, which is shared by extension hosts in
the same VS Code profile. This is intended to make only one window handle a
given Copilot event, including its sound, banner, and iMessage channels.
Automated tests cover two extension-host instances and confirm one sound and
one iMessage for a shared event; live testing with multiple user windows is
confirmed for response sound and an interactive question prompt. The user
reported that the 0.2.3 test worked. The live test did not separately verify
iMessage; its one-send behavior remains covered by the automated test.

## Development and research environment

The extension uses TypeScript, Node.js in the local/UI extension host, esbuild,
and the VS Code Extension API. It is currently macOS-only. Run
`npm run check-types`, `npm test`, and `npm run package` to validate it.
Compilation writes the extension bundle to the generated, Git-ignored
`dist/` directory. Packaging writes the versioned VSIX to the generated,
Git-ignored `artifacts/` directory.

## Initial development direction

The implementation uses user-level Copilot `sessionStart`, `preToolUse`, and
`agentStop` command hooks plus an extension-global-storage signal file. At
session start, the first hook adds a best-effort instruction to mark final
assistant responses that explicitly ask the user to answer or decide. The
`preToolUse` hook is matched only to `ask_user`; it writes the hook event to a
mode-0600 signal file so the extension can extract the question text. The
extension removes this signal after reading it. At agent stop, the hook writes
the event payload, including the transcript path. The extension reads the last
`assistant.message` entry, selects the completion or question label based on
the marker, and extracts a short summary locally. Missing or unreadable content
falls back to the generic notification text.

The user confirmed that an interactive question prompt triggers the
question-pending notification before they answer, and that Copilot's subsequent
reply triggers the regular completion notification. Normal agent-response
iMessage delivery and explicit question-marker classification are also
confirmed. See the resolved
[B001](./BUGS.md#b001--interactive-question-prompt-does-not-trigger-a-notification)
for the investigation and evidence. Continue validating timing and duplicate
behavior because VS Code documents hooks as a Preview feature, and the
transcript format is an implementation detail.

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
and hook to share a workspace. The agent-stop signal carries the event payload,
including a local transcript path, but does not copy transcript contents. The
extension reads the final assistant message locally for classification and
summary extraction. For `ask_user`, the signal briefly carries the tool input;
it is protected by the hook's `umask 077` and removed after processing.

#### Response category marker

The `agentStop` hook runs after the agent's turn and supplies a transcript path,
not the final response text. The extension reads the VS Code Copilot JSONL
transcript and checks only the most recent `assistant.message` content for
`<!-- ping-when-ready:question -->`. It does not classify by punctuation.
The marker is requested through `sessionStart` hook `additionalContext` and
should be appended as a hidden HTML-comment line only when the final response
explicitly asks the user for an answer or decision. It should not be used for
rhetorical or quoted questions.

If the agent omits the marker, transcript reading fails, or transcript entries
change in a future VS Code version, the extension is designed to send the
ordinary completion notification. Marker recognition changes only the label
to the question-pending message; it never suppresses the agent-stop
notification. For the interactive question UI, a separate `preToolUse` hook
matched to `ask_user` sends the question-pending notification at prompt time.
The extension extracts the first sentence or paragraph locally, cleans common
Markdown formatting, and caps the excerpt at 120 characters. Empty or
unavailable content leaves the generic label unchanged. The
`pingWhenReady.notifications.includeSummary` setting controls whether excerpts
are included; it defaults to enabled and can be disabled for generic-only
notification text. With summaries enabled, bodies are formatted as
**“Agent response: [response text]”** or
**“Question from agent: [question text]”**. Excerpts are included in both
enabled macOS notifications and iMessages, so they may be visible in
notification previews or message history. No remote summarization service is
used.

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

The notification body may also contain a short local excerpt from the agent's
response or interactive question. Keep excerpts concise and expose the
generic-only option in settings because banners and previews can reveal
conversation details.

### Settings and notification channels

Preferences are contributed through `contributes.configuration`. Separate
boolean settings appear as checkboxes in VS Code Settings, and channels can be
enabled together. Search **Ping When Ready** in Settings. Check
**Notifications: macOS** for system banners, **Notifications: iMessage** for
Messages alerts, or both. The native macOS banner is enabled by default;
sound and iMessage are disabled by default.
Sound currently uses an absolute path to a local WAV or MP3 file; the user
plans to provide candidate sounds later. iMessage recipient setup uses VS Code
SecretStorage. Separate commands test iMessage directly and simulate the full
agent-stop notification pipeline.
**Notifications: Include Summary** is enabled by default and adds a short
extractive excerpt to native notifications and iMessages; disable it to keep
the generic-only message text.

### Sound playback

The VS Code API has no general audio-playback function. The current
macOS-only implementation uses the local Node.js extension host to spawn
`afplay` with the configured sound path. It uses an argument array rather
than constructing a shell command from settings. The Activity Bar provides
separate **Choose Response Sound** and **Choose Question Sound** actions that
open VS Code's native file picker filtered to WAV and MP3 files. Selected paths
are saved in global extension settings. If a category-specific sound is empty,
the legacy `soundFile` setting remains a fallback for both categories.
Audio files are not bundled.

The `afplay` usage information checked does not promise a definitive codec
list, so validate both WAV and MP3 assets on the supported macOS version
before claiming compatibility. A small tested set of WAV or AIFF sounds could
avoid adding a decoder dependency. Ensure the extension runs on the local/UI
host, not only a remote host, so audio plays on the Mac. Check licenses for
any sound assets supplied or packaged.

### Optional iMessage notification

VS Code has no iMessage API. The current prototype invokes `/usr/bin/osascript`
to automate the macOS Messages app with AppleScript. It selects an iMessage
service, addresses the configured buddy, and sends the notification text,
including a short response/question excerpt when summaries are enabled. The
user sets the recipient with **Ping When Ready: Set iMessage Recipient**. The
number is stored in VS Code SecretStorage, not in settings, hook arguments,
logs, or repository files. SecretStorage persists across VS Code restarts in
the same profile, so the number only needs to be entered once per profile.
The feature is disabled by default.

The dedicated **Ping When Ready: Send Test iMessage** command requires modal
confirmation before sending a separate test message. A successful AppleScript
command only means the request was accepted by Messages; verify actual
delivery and route in Messages before enabling automatic sends. macOS may ask
for permission for VS Code to control Messages; grant or revoke that under
System Settings > Privacy & Security > Automation.

**Ping When Ready: Test Agent-Stop Notification** simulates the normal
agent-stop notification pipeline and runs the channels currently enabled in
settings. It requires confirmation when iMessage is enabled because it sends
another real message.

Never use undocumented Messages databases or try to bypass macOS consent.
The test send has a 30-second timeout. Error output must not include the
recipient or message body.

#### Feasibility refresh (2026-10-25)

The implementation initially explored Shortcuts, but the user preferred
direct AppleScript automation and the prototype now uses the Messages app's
scripting support. No shortcut creation or Shortcuts command-line setup is
needed.

A phone number does not guarantee iMessage routing. The Mac's Messages
configuration and recipient availability determine whether the message uses
iMessage or another Messages route, including SMS/MMS/RCS when configured.
Before enabling automatic sends, run the confirmed test command and verify
the resulting conversation and message route in Messages.

AppleScript automation depends on the Messages app scripting interface and
macOS Automation consent; it is not a general supported iMessage API.
The exact app identity macOS shows as the automation requester and permission
persistence across OS or VS Code identity/signature changes must be verified
on the installed build.

No first-party Apple API was found for an unrelated VS Code extension to send
arbitrary iMessages. Apple's Messages framework is for extensions that run
inside Messages conversations, not a general desktop sender.

Third-party Node packages remain unnecessary for this prototype:

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

Use the current AppleScript approach only after a user-triggered test. The
recipient is saved in VS Code SecretStorage. AppleScript source is passed to
`osascript` with `execFile`, while recipient and message are separate
arguments; avoid shell interpolation and never log either value.

Keep iMessage disabled by default and clearly explain that enabling it sends
a real message. **Send Test iMessage** and **Test Agent-Stop Notification**
are distinct actions with modal confirmation before any real iMessage send.
Report command/permission errors without
logging the recipient or message body, and never describe a successful
AppleScript execution as proof of message delivery. Verify delivery and
routing manually in Messages.

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

- The user confirmed that a Copilot agent stop successfully triggered a
  notification after the hook signal path was changed from the hook process's
  current working directory to the extension's global storage.
- The user confirmed that the notification now works from the agent-stop hook
  in their VS Code installation.
- The user confirmed normal agent-response iMessage delivery and that an
  explicit final question marker selects the question message. A plain-text
  question without a marker gets the normal message. The interactive Copilot
  question prompt and subsequent completion notification were both confirmed
  after adding a `preToolUse` hook matched to `ask_user`. See the resolved
  [B001](./BUGS.md#b001--interactive-question-prompt-does-not-trigger-a-notification).
- The user confirmed live response and interactive-question summaries display
  with the requested "Agent response: ..." and "Question from agent: ..."
  formats.
- Automated checks cover hook signal creation and hook configuration
  installation/removal, but do not exercise a live Copilot session or prove
  that all Copilot stop attempts correspond to completed user-visible replies.

## Distribution

The extension is intended for private, personal use, not publication as a
public Marketplace extension. Use F5 for development or build a `.vsix` for
local installation. The `.vsix` is stored under `artifacts/`.

### Git authorship

Use the repository owner's configured Git identity for both commit authorship
and committers. Do not add co-author, sign-off, or other attribution trailers
for Copilot, agents, models, bots, or automation. Before publishing, inspect
every outgoing commit's author, committer, and complete message. The local
`.github/` and `.githooks/` directories are intentionally Git-ignored in this
checkout; any files there are local-only unless the owner explicitly approves
a tracking-policy change. Check whether a pre-push hook or CI check is active
before relying on attribution enforcement.
