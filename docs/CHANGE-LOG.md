# Changelog

All notable changes to this project are documented here.

## Unreleased

- Added a macOS-only VS Code extension scaffold with a Copilot `agentStop`
  hook, native macOS notification, optional `afplay` sound, and optional
  Shortcuts-based iMessage channel.
- Added hook enable/disable, test-notification, and signal-bridge commands.
- Changed the hook-to-extension signal handoff to extension global storage;
  the user confirmed that a Copilot stop now triggers a notification.
- Added type-checking, hook configuration and signal tests, development-host
  launch configuration, and local VSIX packaging.
- WAV/MP3 playback with user-provided files and Shortcuts/iMessage delivery
  remain to be validated.
