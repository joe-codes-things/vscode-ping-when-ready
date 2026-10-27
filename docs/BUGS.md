# Bugs

## Current bugs

No known bugs are currently tracked.

## Bugs resolved

### B002 — Notification sound appears doubled and distorted during playback

- **Component**: macOS sound playback / notification event handling
- **Status**: Fixed
- **Extension version**: 0.2.3
- **Environment**: macOS, VS Code, and Copilot; exact versions are not
  recorded. The user is a professional music producer and reports thoroughly
  checking the custom response and question WAV files in their DAW, where this
  doubling/distortion was not present.
- **Steps to reproduce**:
  1. Enable sound notifications and select the custom response and question
     sound files.
  2. Trigger a completed agent response and an interactive agent question.
- **Expected behavior**: Each notification plays its selected stereo sound
  once, without unexpected doubling, phasey coloration, or distortion.
- **Actual behavior**: The user hears what sounds like two playback sources
  for each triggered sound, with peaking/distortion and a phase-cancellation
  quality when the extension plays the files; the issue was not heard when
  auditioning the exports in the DAW.
- **Workaround**: Not established. Disable the sound channel until the playback
  source is identified if the distortion is disruptive.
- **Resolution**: Added a unique ID to each hook signal and an atomic,
  shared-storage claim so only one VS Code extension host handles a given
  signal and starts its notification channels. Distinct question and response
  events retain their own IDs and still notify independently.
- **Validation**: Automated two-host regression coverage confirms one sound
  launch and one iMessage send for a shared signal, while later distinct
  signals still notify. The user then tested the 0.2.3 build with response
  sound enabled and exercised the interactive question prompt, reporting that
  the test worked. The user has not separately reported an iMessage result from
  this live multi-window test; iMessage channel behavior is covered by the
  automated regression test.
- **Investigation (not a confirmed root cause)**:
  - `playSound` calls `spawn("/usr/bin/afplay", [filePath])` once per
    `notify` invocation. It does not explicitly split stereo into two mono
    playbacks, duplicate channels, apply gain, or loop a file. `afplay` sends
    the file to the Mac's default audio output.
  - The exported WAVs are both 48 kHz, 24-bit, 2-channel stereo, and 6.5
    seconds long. Their highest sample peaks are approximately -0.10 dBFS;
    this measurement does not invalidate the user's DAW audition or establish
    the cause of the extension-playback artifact. A simple left/right average
    remains below 0 dBFS, and the response file's left/right correlation is
    approximately -0.014, while the question file's is approximately 0.265;
    neither is a dual-mono copy. These file measurements are context for
    investigating the playback path, not grounds to attribute the issue to the
    user's mix, export, or listening.
  - The inspected extension path passes the stereo file once to `afplay` and
    has no explicit channel-splitting step. This does not explain away the
    user's observation or rule out duplication elsewhere in the extension or
    macOS output path; continue investigating those paths.
  - Each distinct notification signal starts another `afplay` process, and
    there is no overlap prevention. Separate question-prompt and agent-stop
    events are designed to notify at different points in an interaction.
    VS Code documents that applicable hooks from multiple sources run
    together, so duplicate hook definitions or repeated hook events could
    also create multiple sound processes. The file watcher listens for both
    create and change events and compares signal contents to suppress repeated
    handling of identical content, but this does not merge distinct signals.
    These are plausible paths to overlapping playback, not evidence that
    either occurred during the user's test.
  - The fix adds a UUID to each hook invocation and uses exclusive
    file creation in shared extension global storage to let exactly one
    extension host claim each signal. A two-host automated regression test
    confirms the same signal starts one sound and sends one iMessage; a later
    distinct signal still notifies. The user confirmed the notification test
    worked in the multi-window setup.
  - Next useful evidence is the extension-side trigger count and number of
    active `afplay` processes during the reported playback. Correlate those
    with the existing timestamped hook entries in Output > Ping When Ready,
    and inspect how the extension playback path reaches the selected output.
    Any additional comparison should isolate that path and must not presume a
    problem with audio the user has already checked in their DAW.
- **Important investigation constraint**: Accept the user's report as credible:
  the files were checked in a DAW by a professional music producer, and the
  reported doubling, phasey quality, and distortion occur with extension
  playback. Do not imply the user overlooked clipping, distortion, mix,
  export, channel routing, or other audio-quality issues. Do not use
  measurements or speculation to dismiss the report or shift blame to the
  source files. Focus investigation on the extension and its playback/output
  path, label hypotheses as hypotheses, and ask before requesting any further
  test of the audio itself.
- **Research**:
  [VS Code agent hooks](https://code.visualstudio.com/docs/agent-customization/hooks)
  documents that hooks are in Preview and that applicable hooks from multiple
  sources run together.
  [Apple: Change the sound output settings on Mac](https://support.apple.com/guide/mac-help/change-the-sound-output-settings-mchlp2256/mac)
  describes routing audio through the configured Mac output device. The
  installed `afplay` help and man page describe playback to the default output
  and provide no channel-splitting option.

## Previously resolved bugs

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
