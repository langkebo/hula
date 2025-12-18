#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command="${1:-restart}"

bash "$SCRIPT_DIR/run.sh" luohuo-ai-server luohuo-ai prod "$command"
