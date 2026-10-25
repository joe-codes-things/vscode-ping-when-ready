# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added a macOS-only VS Code extension scaffold with a Copilot `agentStop`
  hook, native macOS notification, optional `afplay` sound, and optional
  Messages/AppleScript iMessage channel.
- Added hook enable/disable commands.
- Changed the hook-to-extension signal handoff to extension global storage;
  the user confirmed that a Copilot stop now triggers a notification.
- Added type-checking, hook configuration and signal tests, development-host
  launch configuration, and local VSIX packaging.
- Switched the iMessage prototype from Shortcuts to direct AppleScript
  automation of Messages, with the recipient held in VS Code SecretStorage.
- Recorded the user's successful live Copilot stop-hook notification test.
- Added a separate, confirmation-gated test-iMessage command; the ordinary
  notification test and signal-bridge commands were removed from the palette
  so only the iMessage setup/test commands remain available there.
- Added a confirmation-gated agent-stop notification test command to exercise
  the enabled notification channels together.
- Added a session-start hook instruction for the hidden question marker and
  final-assistant-message transcript classification. Question-marked turns
  send "Question from agent pending."; unmarked or unclassifiable turns send
  "Agent response ready for review."
- The user confirmed normal agent-response iMessage delivery, but observed no
  notification for an agent question prompt. Tracking the question-notification
  failure in [Bugs](./BUGS.md#b001--question-prompt-does-not-trigger-a-notification).
- Added a 30-second timeout and explicit messaging that a successful Apple
  Events request does not prove delivery.
- WAV/MP3 playback with user-provided files and question-marker behavior in
  live Copilot sessions remain to be validated.
