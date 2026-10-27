# Project Agent Instructions

## Audio playback issue: respect the user's test findings

- Treat B002 in `docs/BUGS.md` as a genuine extension playback defect under
  investigation. The user is a professional music producer and reports that
  they thoroughly checked the exported sounds in their DAW; the doubling,
  phasey sound, and distortion occur when the extension plays them.
- Do not suggest or imply that the user failed to check clipping, distortion,
  mix, export, or channel routing. Do not default to blaming the source audio,
  the DAW export, the user's hearing, or user error.
- Do not use sample-peak measurements, stereo metadata, or unverified playback
  assumptions to dismiss or contradict the user's listening report. Such data
  may help investigate the extension and output path; it is not proof that the
  reported defect is absent.
- Investigate the extension-triggered playback path first: notification and
  hook counts, concurrent `afplay` processes, duplicate event handling,
  output-device routing, and differences between DAW playback and extension
  playback. Clearly distinguish observed facts from hypotheses.
- Hook notifications are coordinated across VS Code windows using a unique
  signal ID and an atomic claim in shared extension global storage. Preserve
  this deduplication around the entire notification-channel fan-out so the
  same event does not launch multiple sounds, banners, or iMessages, while
  distinct later events remain eligible.
- If further comparison is genuinely needed, ask for a targeted test that
  isolates the extension or macOS playback path. Do not make the user repeat
  work they have already reported doing or frame the request as checking their
  mix/export for mistakes.
- Keep B002 open until the user confirms the issue is resolved. Discuss
  findings before making playback changes when the user asks for discussion
  only.
