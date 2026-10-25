#!/bin/sh

if [ "$#" -ne 1 ]; then
  printf '%s\n' "Expected the Ping When Ready signal-file path as the only argument." >&2
  printf '{}\n'
  exit 0
fi

signal_file="$1"
signal_directory="$(dirname "$signal_file")"
temporary_file="${signal_file}.$$"

if mkdir -p "$signal_directory" &&
  printf '%s:%s\n' "$(date +%s)" "$$" > "$temporary_file" &&
  mv -f "$temporary_file" "$signal_file"; then
  :
else
  printf '%s\n' "Ping When Ready could not write the agent-stop signal." >&2
  rm -f "$temporary_file"
fi

printf '{}\n'
