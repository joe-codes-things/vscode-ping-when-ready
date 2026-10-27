# Ping When Ready

A personal macOS VS Code extension that uses Copilot hooks to trigger a native
macOS notification, optional sound, and optional iMessage when an agent finishes
a response or asks the user for input. The `ask_user` prompt notification and
follow-up completion notification have been confirmed in a live Extension
Development Host session. Copilot hooks are in Preview, so broader timing and
duplicate behavior still need validation.

## Development

1. Run `npm install`.
2. Open this folder in VS Code and press **F5** to launch an Extension
   Development Host.
3. In the normal VS Code window, click the **Ping When Ready** icon in the
   Activity Bar (the vertical icon strip on the left). Its **Notifications**
   view has checkboxes for macOS notifications, sound, iMessage, and summary
   text. Use the view's gear button to open the extension's filtered Settings,
   or choose **Choose Sound File…** and **Set iMessage Recipient…** directly
   in the view.
4. In the Extension Development Host, run **Ping When Ready: Enable Copilot Notification Hooks**
   to install or update the user-level Copilot hooks. Start a new Copilot
   session; its session-start hook supplies the marker instruction to the agent.
5. To test iMessage, run **Ping When Ready: Set iMessage Recipient** and enter
   a number in international format (for example, `+14155550123`). It is
   stored persistently in VS Code SecretStorage, not in workspace settings or
   this repo; you only need to set it once per VS Code profile.
6. Run **Ping When Ready: Send Test iMessage**. It asks for confirmation
   before sending a real message; check Messages to verify actual delivery.
7. Open **Settings** (`Cmd+,`) and search for **Ping When Ready**. Check
   **Notifications: macOS** for system banners, **Notifications: iMessage**
   for Messages alerts, or both. Leave either unchecked to disable that
   channel. iMessage stays off until you check its box.
8. Run **Ping When Ready: Test Agent-Stop Notification** to simulate the hook
   and test the enabled notification channels. It asks for confirmation if
   iMessage is enabled because it sends a real message.
9. Run `npm run package` to build a `.vsix` for local installation. The
   compiled bundle is in `dist/`; the installable package is written to
   `artifacts/`.

The extension uses the red notification-bell artwork supplied in `ui/` for its
extension icon. `resources/icon.png` is the VS Code extension-list icon, and
`resources/ping.svg` is the matching Activity Bar icon. The source archive is
kept in the repository but excluded from the packaged VSIX.

For an agent response that explicitly needs your answer or decision, the
extension asks the agent to append a hidden `<!-- ping-when-ready:question -->`
marker on its final line. When a short summary is available, notifications use
**“Question from agent: [question text]”** or
**“Agent response: [response text]”**. The excerpt is extracted locally and
capped at 120 characters. Disable **Notifications: Include Summary** in
Settings to use generic-only text. When a summary is unavailable, the
extension uses **“Question from agent pending.”** or
**“Agent response ready for review.”** The marker is a best-effort hint;
missing it still produces the normal completion notification.

The macOS banner is enabled by default. Sound and iMessage are off by default.
Configure a WAV or MP3 path in Settings before enabling sound. iMessage sends
through Messages using AppleScript; macOS may ask you to grant VS Code
automation access. Test sends are explicitly confirmed. The extension does
not log the phone number or include it in the repository.

See [Project Onboarding](./docs/ONBOARDING.md) for project context,
[Feature Ideas](./docs/FEATURE-IDEAS.md) for open design questions, and
[Bugs](./docs/BUGS.md) for reported issues.
