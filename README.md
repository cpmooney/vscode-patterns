# Code From Patterns VS Code Extension

This extension allows you to scaffold code based on patterns you like and have stored in a directory modified using
the power of AI.

## Setup

- Install VS Code and set up Github Copilot
- Install the "Code From Patterns" extension
- Set the environment variable `CODE_PATTERN_DIRECTORY` to the directory containing your patterns

## Requirements

- VS Code with Copilot

## Usage

1. Use the Copilot prompt `@smart-scaffold` and include a prompt describing the desired new use case.
2. Click the "Write to file" button.
3. The new files will be added to appropriate directories in the directory you have currently open.

## Compile

1. `yarn make-prod`
