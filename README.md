# Ping When Ready

A personal macOS VS Code extension that uses Copilot hooks to trigger a native
macOS notification, optional sound, and optional iMessage when an agent finishes
a response or asks the user for input. The `ask_user` prompt notification and
follow-up completion notification have been confirmed in a live Extension
Development Host session. Version 0.2.3's cross-window response-sound and
interactive-question notification behavior has also been confirmed in live
testing. Copilot hooks are in Preview, so behavior may vary across updates.

## Development

1. Run `npm install`.
2. Open this folder in VS Code and press **F5** to launch an Extension
   Development Host.
3. In the normal VS Code window, click the **Ping When Ready** icon in the
   Activity Bar (the vertical icon strip on the left). Its **Notifications**
   view has checkboxes for macOS notifications, sound, iMessage, and summary
   text. Use **Choose Response Sound…** and **Choose Question Sound…** to
   select separate WAV or MP3 files in the native file picker, and
   **Set iMessage Recipient…** to configure Messages.
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

The extension uses the red notification-bell artwork supplied in
`user-interface/` for its
extension icon. `resources/icon.png` is the VS Code extension-list icon, and
`resources/ping.svg` is the matching Activity Bar icon. The source archive is
kept in the repository but excluded from the packaged VSIX.
When the same Copilot hook signal is visible in multiple VS Code windows, a
shared atomic claim ensures notification channels run only once for that
signal.

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
Enable **Sound**, then choose separate WAV or MP3 files for agent responses
and questions from the sidebar; either can be left unconfigured, but a sound
must be selected for each notification type you want to hear. Existing
`soundFile` settings remain as a fallback for both types. iMessage sends
through Messages using AppleScript; macOS may ask you to grant VS Code
automation access. Test sends are explicitly confirmed. The extension does
not log the phone number or include it in the repository.

See [Project Onboarding](./docs/ONBOARDING.md) for project context,
[Feature Ideas](./docs/FEATURE-IDEAS.md) for open design questions, and
[Bugs](./docs/BUGS.md) for reported issues.
