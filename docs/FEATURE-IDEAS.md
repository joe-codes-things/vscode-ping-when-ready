# Feature Ideas

Ideas are being collected for discussion and prototyping.

## Tracking format

Assign the next available ID (`F001`, `F002`, ...). Include:

- **Title**
- **Component**
- **Status**: Proposed, Exploring, Planned, Implemented, or Declined
- **User problem**
- **Proposed behavior**
- **Trade-offs or open questions**
- **References** (for researched ideas)

## Ideas

### F001 — Notify when an agent finishes responding

- **Component**: VS Code extension
- **Status**: Implemented (initial macOS prototype; live Copilot stop trigger
  and native notification confirmed by user)
- **User problem**: It is easy to miss when an agent has finished responding,
  especially when attention is elsewhere.
- **Proposed behavior**: Use Copilot's `agentStop` hook to trigger a native
  macOS notification, with optional sound and iMessage channels.
- **Trade-offs or open questions**: VS Code's hooks are in Preview and need
  broader testing for timing and duplicate behavior. WAV/MP3 sound playback
  and Shortcuts-based iMessage delivery are not yet validated. Keep the
  extension private and intended for personal use.
- **References**:
  [VS Code agent hooks guide](https://code.visualstudio.com/docs/agent-customization/hooks)
  and [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference).

### F002 — Send an iMessage when an agent finishes

- **Component**: Optional macOS notification channel
- **Status**: Exploring
- **User problem**: The user may want to receive a completion alert in Messages
  as well as on the Mac running VS Code.
- **Proposed behavior**: Run a user-configured macOS Shortcut that sends a
  generic completion message to one recipient.
- **Trade-offs or open questions**: Research favors a user-created Shortcut
  over AppleScript/JXA or third-party libraries for this one-recipient case.
  Validate setup, macOS Automation permissions, persistence across app/system
  updates, iMessage-versus-SMS behavior, and delivery/error reporting. Keep
  recipient details in the Shortcut (not the repository) and default the
  feature off. The current general test-notification command may send a real
  iMessage if the channel is enabled; add an explicit confirmation before
  offering test sends.
- **References**: Initial research is recorded in
  [Project Onboarding](./ONBOARDING.md); repeat a setup/send test before
  enabling automatic delivery.
