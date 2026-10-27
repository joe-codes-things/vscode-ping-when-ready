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

### F003 — Summarize response topics in a few words

- **Component**: Completed-response notification summaries
- **Status**: Exploring
- **User problem**: The current response notification excerpts can include a
  full first sentence, which may be longer or more detailed than needed to
  identify what the agent worked on.
- **Proposed behavior**: For completed agent responses (not questions), show a
  short topic label of a few words, such as “docs updates and security check,”
  rather than the current sentence excerpt. Keep question notifications
  unchanged so the user can see what input is being requested.
- **Trade-offs or open questions**: A model-generated topic label could use
  VS Code's Language Model API on the final response already available in the
  local transcript. VS Code documents `selectChatModels` and `sendRequest`, but
  Copilot model access requires user consent; model selection can fail when no
  matching model is available, consent is missing, or quota is exceeded. The
  API documentation recommends making model selection from a user-initiated
  action because consent may show an authentication dialog, so prompting for
  authorization for the first time in an unattended agent-stop hook would be
  disruptive. Sending response text to a selected provider also has different
  privacy implications from today's local-only extraction. Consider a
  user-initiated setup/preflight consent step, an opt-in setting, a short
  response-only prompt, a strict word-count limit, and fallback to the current
  extractive summary if the model is unavailable or fails. A local
  keyword/extractive label avoids sending conversation content elsewhere but
  may produce less natural topic labels. Keep question detection and its exact
  question text outside the summarization step.
- **References**:
  [VS Code Language Model API guide](https://code.visualstudio.com/api/extension-guides/ai/language-model)
  · [VS Code Language Model API reference](https://code.visualstudio.com/api/references/vscode-api#lm)
  · [VS Code agent hooks guide](https://code.visualstudio.com/docs/agent-customization/hooks).

### F004 — Reply to an agent question through iMessage

- **Component**: Optional macOS Messages integration / question-response flow
- **Status**: Exploring
- **User problem**: When away from VS Code, the user may want to answer an
  agent's interactive question from Messages instead of returning to the
  editor.
- **Proposed behavior**: Allow the user to reply to a question notification
  through the existing iMessage conversation, associate that inbound reply
  with the pending agent question, and make the answer available to the agent
  or resume the paused session.
- **Trade-offs or open questions**: Sending outbound messages through Messages
  with AppleScript is already prototyped, but sending does not provide a
  general inbound-reply API. Apple's documented Messages framework
  (`MSConversation`) is available for iOS, iPadOS, and Mac Catalyst—not a
  general macOS VS Code extension—and its APIs operate in a Messages app
  conversation context. Apple's Mac user guide documents replying inside
  Messages as a user action, not an automation API for third-party Mac apps.
  However, older community integrations demonstrate a Messages AppleScript
  handler with an `on message received` event that receives message text,
  sender, and chat. This suggests an inbound listener may be possible through
  Messages' legacy script-handler facility, configured in the app's
  AppleScript handler preferences. Those examples are not current Apple
  documentation and do not establish that the handler still works reliably on
  the target macOS release; test it before choosing this approach. It may
  require a persistent script installation, Messages to be running, Automation
  permission, and replacing or coexisting with the user's existing script
  handler. Limit processing to the expected recipient and pending question;
  never inspect the undocumented Messages database or ingest unrelated
  conversations. A separate blocker remains even if reply capture works:
  research has not found a supported VS Code API for delivering the reply as
  the result of an already-pending `ask_user` tool or resuming another Copilot
  chat session. VS Code's current chat extensibility guidance describes
  plugins/tools for extending workflows and says Chat Participants are
  deprecated and unsupported in the Copilot harness, not a way to control an
  existing session. Any implementation must handle multiple pending questions,
  stale or unrelated replies, sender verification, user consent, and safe
  session correlation without silently injecting unrelated message content
  into an agent session.
- **References**:
  [Apple Messages framework: `MSConversation`](https://developer.apple.com/documentation/messages/msconversation)
  · [Apple Messages framework: `MSMessage`](https://developer.apple.com/documentation/messages/msmessage)
  · [Apple: Send and reply to messages on Mac](https://support.apple.com/guide/messages/send-messages-icht35827/mac)
  · [Apple: Run shortcuts from the command line](https://support.apple.com/guide/shortcuts-mac/run-shortcuts-from-the-command-line-apd455c82f02/mac)
  · [Apple: Limit shortcut input when run from another app](https://support.apple.com/guide/shortcuts-mac/limit-the-input-for-a-shortcut-apd8195f96d6/mac)
  · [VS Code AI extensibility overview](https://code.visualstudio.com/api/extension-guides/ai/ai-extensibility-overview)
  · [VS Code Chat Participants (deprecated)](https://code.visualstudio.com/api/extension-guides/ai/chat)
  · [Community example: Hubot iMessage adapter setup](https://github.com/lazerwalker/hubot-imessage#configure-messagesapp)
  · [Community example: Messages AppleScript receive handler](https://github.com/lazerwalker/hubot-imessage/blob/master/src/Hubot%20Event%20Handler.applescript).
