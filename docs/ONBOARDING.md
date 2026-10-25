# Project Onboarding

## Project overview

This repository is for a personal VS Code extension intended to notify the
user when an agent finishes responding to a message. The planned notification
uses both a VS Code pop-up and a sound. The project is at the idea stage; no
extension behavior has been implemented.

## Architecture at a glance

- No extension source code, package manifest, build process, or tests have
  been established yet.
- The agent response-completion signal and sound playback approach remain to
  be researched.
- The intended audience is the project owner. Public extension distribution is
  not a goal.
- `README.md` is the concise project entry point.
- `docs/BUGS.md` tracks reported issues, and `docs/FEATURE-IDEAS.md` tracks
  design questions and potential behavior.

## Getting familiar with the project

Start with `README.md` for the goal and current scope. Read this document for
project context, then review `docs/FEATURE-IDEAS.md` before choosing an
implementation approach.

## Development and research environment

The extension's implementation language, VS Code API approach, and
development/test workflow have not yet been selected. Establish these when
the response-completion signal and notification behavior are investigated.

## Initial development direction

Research whether VS Code exposes a reliable way for a personal extension to
observe that an agent has completed its response. Confirm that the chosen
signal does not fire for intermediate updates. Then investigate a VS Code
notification and a sound that work on the user's operating system. Document
any limitations before treating the behavior as supported.

## Distribution

The extension is intended for private, personal use, not publication as a
public Marketplace extension. Decide on a local installation and update
workflow once an implementation exists.
