# Bugs

## Current bugs

### B001 — Question prompt does not trigger a notification

- **Component**: Copilot hook / response-category detection
- **Status**: Open
- **Extension version**: 0.0.1 (development build)
- **Environment**: macOS; VS Code version and Copilot session target/version
  not recorded
- **Steps to reproduce**:
  1. Enable the Ping When Ready Copilot hooks.
  2. Start a new Copilot chat session.
  3. Ask the agent a task that ends by prompting the user for an answer.
- **Expected behavior**: The agent-stop hook triggers a notification. If the
  final assistant message has the question marker, use
  “Question from agent pending.”; otherwise use
  “Agent response ready for review.”
- **Actual behavior**: A normal response notification works, but no
  notification fired when the agent displayed a question prompt. It is not
  yet known whether the stop hook failed to run, the session-start marker
  instruction was not followed, or the transcript parser failed to classify
  the final message.
- **Workaround**: No known workaround. Normal completion notifications remain
  verified.

## Bugs resolved

No bugs have been resolved yet.

## Reporting format

Assign the next unused sequential ID (currently `B001`). Include:

- **Title**
- **Component**
- **Status**: Open, In Progress, Fixed, or Closed
- **Extension version** (if applicable)
- **Environment**: VS Code version, OS, and agent/provider
- **Steps to reproduce**
- **Expected behavior**
- **Actual behavior**
- **Workaround** (if any)
