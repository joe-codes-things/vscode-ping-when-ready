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
  broader testing for timing and duplicate behavior. Question classification
  uses a best-effort marker in the final assistant transcript and needs live
  validation. WAV/MP3 sound playback remains unvalidated. Keep the extension
  private and intended for personal use.
- **References**:
  [VS Code agent hooks guide](https://code.visualstudio.com/docs/agent-customization/hooks)
  and [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference).

### F002 — Send an iMessage when an agent finishes

- **Component**: Optional macOS notification channel
- **Status**: Implemented; user confirmed agent-response delivery
- **User problem**: The user may want to receive a completion alert in Messages
  as well as on the Mac running VS Code.
- **Proposed behavior**: Use AppleScript through `osascript` to request a
  message from Messages when the Copilot agent-stop hook triggers. Use
  separate fixed messages for normal responses and questions detected by a
  marker in the final assistant transcript. A test command sends a test
  message after explicit confirmation.
- **Trade-offs or open questions**: Validate macOS Automation permission,
  marker compliance and question/response classification with live sessions.
  A successful AppleScript command does not prove delivery. Store the
  recipient in VS Code SecretStorage, never in the repository, and keep the
  feature disabled by default.
- **References**: Research and setup instructions are recorded in
  [Project Onboarding](./ONBOARDING.md).
