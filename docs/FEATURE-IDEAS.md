# Feature Ideas

Ideas are tracked here before implementation begins or while they are being
developed.

## Tracking format

Assign the next available ID (`F001`, `F002`, ...). Include:

- **Title**
- **Component**
- **Status**: Proposed, Exploring, Planned, Built, or Abandoned
- **User problem**
- **Proposed behavior**
- **Trade-offs or open questions**
- **References** (for researched ideas)

Every idea must retain an explicit status whenever this document is edited.
When work is completed or intentionally stopped, update its status to **Built**
or **Abandoned**, respectively.

## Ideas

### F001 — Notify when an agent finishes responding or asks for input

- **Component**: VS Code extension
- **Status**: Built (core completion and question notifications are implemented
  and confirmed in live testing; optional sound and iMessage channels have
  separate validation details in [Project Onboarding](./ONBOARDING.md))
- **User problem**: It is easy to miss when an agent has finished responding
  or is waiting for the user, especially when attention is elsewhere.
- **Proposed behavior**: Trigger native macOS notifications for completed
  agent turns and interactive questions, with optional sound and iMessage
  channels.
- **Trade-offs or open questions**: VS Code's agent hooks are in Preview, so
  continue monitoring behavior across VS Code and Copilot updates. Keep the
  extension private and intended for personal use.
- **References**:
  [VS Code agent hooks guide](https://code.visualstudio.com/docs/agent-customization/hooks)
  and [Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference).

### F002 — Include a concise response or question summary in notifications

- **Component**: Notification content / Copilot hook processing
- **Status**: Built (automated tests pass; the user confirmed both summary
  notification formats in live testing)
- **User problem**: Generic notifications say that an agent is ready or has a
  question, but do not help the user decide whether to switch back immediately.
- **Proposed behavior**: For completed turns, derive a short, bounded excerpt
  from the final assistant message in the local transcript. For interactive
  questions, derive it from the `ask_user` tool arguments. Format notification
  bodies as `Agent response: [response text]` or
  `Question from agent: [question text]`; retain the generic message when
  usable content is unavailable.
- **Trade-offs or open questions**: Summaries are deterministic local
  extraction, not model-generated abstracts: the first sentence or paragraph
  is cleaned and capped at 120 characters. The matching `ask_user` hook input
  is briefly written to the mode-0600 signal file; the extension reads and
  removes the file before notifying. Response excerpts remain in the Copilot
  transcript as before. Notification text can reveal private conversation
  details in banners, previews, or iMessages; the
  `pingWhenReady.notifications.includeSummary` setting defaults to enabled
  for this personal-use workflow and can be disabled for generic-only text.
  The user confirmed the prompt payload extraction and expected notification
  formatting in a live VS Code test. Continue monitoring transcript parsing
  and notification behavior across hook/runtime updates.
- **References**:
  [VS Code agent hooks guide](https://code.visualstudio.com/docs/agent-customization/hooks)
  · [Copilot hook event inputs](https://docs.github.com/en/copilot/reference/hooks-reference#hook-event-input-payloads)
  · [Apple: Displaying Notifications](https://developer.apple.com/library/archive/documentation/LanguagesUtilities/Conceptual/MacAutomationScriptingGuide/DisplayNotifications.html).
