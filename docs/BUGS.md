# Bugs

## Current bugs

No known bugs are currently tracked.

## Bugs resolved

### B001 — Interactive question prompt does not trigger a notification

- **Component**: Copilot hook / interactive question lifecycle
- **Status**: Fixed
- **Extension version**: 0.1.0 development build
- **Environment**: macOS; VS Code Extension Development Host using the Copilot
  session target. Exact macOS, VS Code, and Copilot versions are not recorded.
- **Steps to reproduce**:
  1. Enable Ping When Ready's Copilot notification hooks and start a new
     Copilot session.
  2. Ask Copilot to use the interactive question prompt and wait for an answer.
- **Expected behavior**: Notify when the prompt asks for input, before the
  user answers; after the user responds, notify again when Copilot completes
  its follow-up response.
- **Actual behavior before the fix**: The interactive prompt did not produce
  an `agentStop` signal while waiting. The hook fired only after the user
  answered and Copilot completed a follow-up response.
- **Resolution**: Added a `preToolUse` hook matched only to Copilot's
  `ask_user` tool. It writes the hook event to a mode-0600 question-prompt
  signal so the extension can extract the question text and show
  “Question from agent: [question text]”. The extension removes the signal
  after processing. The existing `agentStop` hook continues to report the
  completed follow-up response. The user confirmed the interactive-prompt
  notification works in a live Extension Development Host session.
- **Validation**: Automated hook/configuration tests, type-checking, and
  compilation pass. Live Copilot testing confirmed the prompt notification
  arrives before answering, and the regular completion notification arrives
  after Copilot responds to the answer. Follow-up testing confirmed local
  question and response summaries appear with the expected labels.
- **Research**: VS Code's documented Copilot hook events do not include the
  Copilot CLI `notification` event. GitHub documents `ask_user` as a tool and
  `preToolUse` matchers as a supported way to target tools.
  [VS Code agent hooks](https://code.visualstudio.com/docs/agent-customization/hooks)
  · [GitHub Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference)

## Reporting format

Assign the next unused sequential ID (currently `B002`). Include:

- **Title**
- **Component**
- **Status**: Open, In Progress, Fixed, or Closed
- **Extension version** (if applicable)
- **Environment**: VS Code version, OS, and agent/provider
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Workaround** (if any)
