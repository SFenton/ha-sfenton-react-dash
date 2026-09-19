#!/bin/sh
set -eu

if [ -z "${ACTIONS_RUNNER_JIT_CONFIG:-}" ]; then
  echo "ACTIONS_RUNNER_JIT_CONFIG is required" >&2
  exit 1
fi

exec ./run.sh --jitconfig "$ACTIONS_RUNNER_JIT_CONFIG"
