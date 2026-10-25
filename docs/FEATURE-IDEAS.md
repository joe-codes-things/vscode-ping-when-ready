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
- **Status**: Exploring
- **User problem**: It is easy to miss when an agent has finished responding,
  especially when attention is elsewhere.
- **Proposed behavior**: Show a VS Code pop-up notification and play a sound
  when the agent has finished responding to the user's message.
- **Trade-offs or open questions**: Determine which VS Code agent/chat
  completion signal is available and reliable, how to avoid notifying before
  a response is truly complete, and whether the sound should be configurable
  or easy to mute. Keep the extension private and intended for personal use.
- **References**: None yet.
