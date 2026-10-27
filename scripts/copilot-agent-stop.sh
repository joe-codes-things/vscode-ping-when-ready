#!/bin/sh

if [ "$#" -lt 1 ]; then
  printf '%s\n' "Expected a Ping When Ready hook mode." >&2
  printf '{}\n'
  exit 0
fi

hook_mode="$1"

if [ "$hook_mode" = "session-start" ]; then
  printf '%s\n' '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"For Ping When Ready notifications, if your final response explicitly asks the user to answer a question or provide a decision, append this exact marker on its own final line: <!-- ping-when-ready:question -->. Do not use it for rhetorical or quoted questions, or when no reply is needed. If uncertain, omit it. The extension uses the marker only to label the notification; always provide your normal complete response."}}'
  exit 0
fi

if [ "$hook_mode" = "question-prompt" ]; then
  if [ "$#" -ne 2 ]; then
    printf '%s\n' "Invalid question-prompt hook arguments." >&2
    printf '{}\n'
    exit 0
  fi

  signal_file="$2"
  signal_directory="$(dirname "$signal_file")"
  temporary_file="${signal_file}.$$"
  signal_timestamp="$(date -u '+%Y-%m-%dT%H:%M:%SZ')-$$"

  umask 077
  if cat >/dev/null &&
    mkdir -p "$signal_directory" &&
    printf '{"hookEventName":"pingWhenReadyQuestionPrompt","timestamp":"%s"}\n' "$signal_timestamp" > "$temporary_file" &&
    mv -f "$temporary_file" "$signal_file"; then
    :
  else
    printf '%s\n' "Ping When Ready could not write the question-prompt signal." >&2
    rm -f "$temporary_file"
  fi

  printf '{}\n'
  exit 0
fi

if [ "$hook_mode" != "agent-stop" ] || [ "$#" -ne 2 ]; then
  printf '%s\n' "Invalid Ping When Ready hook arguments." >&2
  printf '{}\n'
  exit 0
fi

signal_file="$2"
signal_directory="$(dirname "$signal_file")"
temporary_file="${signal_file}.$$"

umask 077
if mkdir -p "$signal_directory" &&
  cat > "$temporary_file" &&
  mv -f "$temporary_file" "$signal_file"; then
  :
else
  printf '%s\n' "Ping When Ready could not write the agent-stop signal." >&2
  rm -f "$temporary_file"
fi

printf '{}\n'
