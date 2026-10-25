# Project Onboarding

## Project overview

This repository contains a personal, macOS-focused VS Code extension for
notifying the user when a GitHub Copilot agent finishes a turn. It uses
Copilot's `agentStop` hook and supports a native macOS notification, optional
sound, and optional AppleScript automation of Messages for iMessage. The
extension is an early prototype; `agentStop` has been confirmed to trigger a
notification in the user's VS Code installation, but broader reliability and
optional channels still need validation.

## Architecture at a glance

- `src/extension.ts` implements the VS Code extension and notification
  channels.
- `src/hookConfig.ts` installs/removes the user-level Copilot hooks while
  preserving other configured hooks.
- `scripts/copilot-agent-stop.sh` injects the question-marker direction at
  session start and writes the agent-stop event payload to extension global
  storage.
- `src/responseCategory.ts` inspects the final assistant transcript entry for
  the marker; unknown or unreadable transcripts fall back to the completion
  notification.
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
Host; enable or update the hooks there and start a new Copilot-targeted
session.

## Development and research environment

The extension uses TypeScript, Node.js in the local/UI extension host, esbuild,
and the VS Code Extension API. It is currently macOS-only. Run
`npm run check-types`, `npm test`, and `npm run package` to validate it.

## Initial development direction

The implementation uses user-level Copilot `sessionStart` and `agentStop`
command hooks plus an extension-global-storage signal file. At session start,
the first hook adds a best-effort instruction to mark final assistant
responses that explicitly ask the user to answer or decide. At agent stop, the
second hook writes the event payload, including the transcript path. The
extension reads the last `assistant.message` entry and selects one of two
fixed notification messages based on the marker. Missing markers or unreadable
transcripts fall back to the normal completion notification, so the hook still
notifies regardless of classification.

In the user's VS Code installation, normal agent-response iMessage delivery
was confirmed, but a question prompt failed to produce any notification.
Question-category detection is therefore not yet verified end-to-end. Re-run
**Enable Copilot Stop Hook** after installing this update so the session-start
marker instruction is added to the existing user hook configuration.
Investigate whether the hook fires, the agent follows the instruction, and the
transcript parser sees the final marker. Continue validating timing and
duplicate behavior because VS Code documents hooks as a Preview feature, and
the transcript format is an implementation detail. See [B001](./BUGS.md#b001--question-prompt-does-not-trigger-a-notification).

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
and hook to share a workspace. The signal file carries the hook's JSON event
payload, including a local transcript path, but does not copy transcript
contents. The extension reads the final assistant message locally only to
check for the marker; it does not send chat content in notifications.

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
change in a future VS Code version, the extension is designed to send the ordinary
**“Agent response ready for review.”** message. Marker recognition changes
only the label to **“Question from agent pending.”**; it never suppresses the
agent-stop notification. However, the user observed no notification at all for
a question prompt while normal responses worked. This behavior has not yet been
reproduced or diagnosed; see [B001](./BUGS.md#b001--question-prompt-does-not-trigger-a-notification).
Since hooks and transcript structure are preview or implementation details,
validate both types with live Copilot responses.

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
boolean settings appear as checkboxes in VS Code Settings, and channels can be
enabled together. Search **Ping When Ready** in Settings. Check
**Notifications: macOS** for system banners, **Notifications: iMessage** for
Messages alerts, or both. The native macOS banner is enabled by default;
sound and iMessage are disabled by default.
Sound currently uses an absolute path to a local WAV or MP3 file; the user
plans to provide candidate sounds later. iMessage recipient setup uses VS Code
SecretStorage. Separate commands test iMessage directly and simulate the full
agent-stop notification pipeline.

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

VS Code has no iMessage API. The current prototype invokes `/usr/bin/osascript`
to automate the macOS Messages app with AppleScript. It selects an iMessage
service, addresses the configured buddy, and sends a generic completion
message; it does not include the agent's response text. The user sets the
recipient with **Ping When Ready: Set iMessage Recipient**. The number is
stored in VS Code SecretStorage, not in settings, hook arguments, logs, or
repository files. SecretStorage persists across VS Code restarts in the same
profile, so the number only needs to be entered once per profile. The feature
is disabled by default.

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
- The user confirmed normal agent-response iMessage delivery, but reported
  that no notification fired for a question prompt. Question-marker
  classification has not been validated end-to-end; see
  [B001](./BUGS.md#b001--question-prompt-does-not-trigger-a-notification).
- Automated checks cover hook signal creation and hook configuration
  installation/removal, but do not exercise a live Copilot session or prove
  that all Copilot stop attempts correspond to completed user-visible replies.

## Distribution

The extension is intended for private, personal use, not publication as a
public Marketplace extension. Use F5 for development or build a `.vsix` for
local installation.
