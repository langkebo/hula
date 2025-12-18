#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

/bin/bash "$SCRIPT_DIR/restart-luohuo-gateway.sh" stop
/bin/bash "$SCRIPT_DIR/restart-luohuo-oauth.sh" stop
/bin/bash "$SCRIPT_DIR/restart-luohuo-base.sh" stop
/bin/bash "$SCRIPT_DIR/restart-luohuo-system.sh" stop
/bin/bash "$SCRIPT_DIR/restart-luohuo-ai.sh" stop
/bin/bash "$SCRIPT_DIR/restart-luohuo-im.sh" stop
/bin/bash "$SCRIPT_DIR/restart-luohuo-ws.sh" stop
