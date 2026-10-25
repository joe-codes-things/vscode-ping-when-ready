# Ping When Ready

A personal macOS VS Code extension that uses a Copilot agent-stop hook to
trigger a native macOS notification, optional sound, and optional iMessage.
Copilot hooks are in Preview, so completion timing still needs to be validated
in real sessions.

## Development

1. Run `npm install`.
2. Open this folder in VS Code and press **F5** to launch an Extension
   Development Host.
3. In the Extension Development Host, run **Ping When Ready: Enable Copilot Stop Hook** to install a user-level
   Copilot hook. Start a new Copilot session to use it.
4. Use **Ping When Ready: Send Test Notification** to test enabled channels.
5. Use **Ping When Ready: Test Signal Bridge** to confirm the hook-to-extension
   signal is working; this does not test whether Copilot fires `agentStop`.
6. Run `npm run package` to build a `.vsix` for local installation.

The macOS banner is enabled by default. Sound and iMessage are off by default.
Configure a WAV or MP3 path and a macOS Shortcut in Settings before enabling
those channels. Put the recipient and a generic completion message in the
Shortcut; the extension does not store the phone number.

See [Project Onboarding](./docs/ONBOARDING.md) for project context,
[Feature Ideas](./docs/FEATURE-IDEAS.md) for open design questions, and
[Bugs](./docs/BUGS.md) for reported issues.
