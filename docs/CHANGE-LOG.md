# Changelog

All notable changes to this project are documented here.

## 0.1.0 - 2026-10-26

- Added a macOS-only VS Code extension scaffold with a Copilot `agentStop`
  hook, native macOS notification, optional `afplay` sound, and optional
  Messages/AppleScript iMessage channel.
- Added hook enable/disable commands.
- Changed the hook-to-extension signal handoff to extension global storage;
  the user confirmed that a Copilot stop now triggers a notification.
- Added type-checking, hook configuration and signal tests, development-host
  launch configuration, and local VSIX packaging. Compiled output is kept in
  `dist/`, and versioned VSIX packages are written to `artifacts/`; both are
  ignored by Git.
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
- The user verified that an explicitly included question marker selects the
  question iMessage. Plain-text questions without the marker use the normal
  completion message. Added a `preToolUse` hook matched to `ask_user` so
  interactive prompts trigger a question-pending notification before the user
  answers. The user confirmed the prompt notification and subsequent
  completion notification in a live Extension Development Host session.
  See the resolved
  [B001](./BUGS.md#b001--interactive-question-prompt-does-not-trigger-a-notification)
  record.
- Added a 30-second timeout and explicit messaging that a successful Apple
  Events request does not prove delivery.
- Added local, extractive response and question excerpts to notification
  messages, capped at 120 characters. The setting
  `pingWhenReady.notifications.includeSummary` defaults to enabled and can
  restore generic-only text. Summary notifications use the formats
  "Agent response: [response text]" and
  "Question from agent: [question text]". Interactive prompt input is held
  briefly in a mode-0600 signal file and removed after processing; no external
  summarizer is used.
- The user confirmed live notifications display
  "Agent response: [response text]" and
  "Question from agent: [question text]" as requested.
- WAV/MP3 playback and agent compliance with the question marker remain to be
  validated in live Copilot sessions.
