# Ping When Ready

A personal macOS VS Code extension that uses a Copilot agent-stop hook to
trigger a native macOS notification, optional sound, and optional iMessage.
Copilot hooks are in Preview, so completion timing still needs to be validated
in real sessions.

## Development

1. Run `npm install`.
2. Open this folder in VS Code and press **F5** to launch an Extension
   Development Host.
3. In the Extension Development Host, run **Ping When Ready: Enable Copilot Stop Hook**
   to install or update the user-level Copilot hooks. Start a new Copilot
   session; its session-start hook supplies the marker instruction to the agent.
4. To test iMessage, run **Ping When Ready: Set iMessage Recipient** and enter
   a number in international format (for example, `+14155550123`). It is
   stored persistently in VS Code SecretStorage, not in workspace settings or
   this repo; you only need to set it once per VS Code profile.
5. Run **Ping When Ready: Send Test iMessage**. It asks for confirmation
   before sending a real message; check Messages to verify actual delivery.
6. Open **Settings** (`Cmd+,`) and search for **Ping When Ready**. Check
   **Notifications: macOS** for system banners, **Notifications: iMessage**
   for Messages alerts, or both. Leave either unchecked to disable that
   channel. iMessage stays off until you check its box.
7. Run **Ping When Ready: Test Agent-Stop Notification** to simulate the hook
   and test the enabled notification channels. It asks for confirmation if
   iMessage is enabled because it sends a real message.
8. Run `npm run package` to build a `.vsix` for local installation.

For an agent response that explicitly needs your answer or decision, the
extension asks the agent to append a hidden `<!-- ping-when-ready:question -->`
marker on its final line. When that marker is present in the final assistant
message, notifications say **“Question from agent pending.”** Otherwise they
say **“Agent response ready for review.”** The marker is a best-effort hint;
missing it still produces the normal completion notification.

The macOS banner is enabled by default. Sound and iMessage are off by default.
Configure a WAV or MP3 path in Settings before enabling sound. iMessage sends
through Messages using AppleScript; macOS may ask you to grant VS Code
automation access. Test sends are explicitly confirmed. The extension does
not log the phone number or include it in the repository.

See [Project Onboarding](./docs/ONBOARDING.md) for project context,
[Feature Ideas](./docs/FEATURE-IDEAS.md) for open design questions, and
[Bugs](./docs/BUGS.md) for reported issues.
