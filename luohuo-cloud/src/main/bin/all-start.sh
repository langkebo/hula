#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

/bin/bash "$SCRIPT_DIR/restart-luohuo-gateway.sh" restart
/bin/bash "$SCRIPT_DIR/restart-luohuo-oauth.sh" restart
/bin/bash "$SCRIPT_DIR/restart-luohuo-base.sh" restart
/bin/bash "$SCRIPT_DIR/restart-luohuo-system.sh" restart
/bin/bash "$SCRIPT_DIR/restart-luohuo-ai.sh" restart
/bin/bash "$SCRIPT_DIR/restart-luohuo-im.sh" restart
/bin/bash "$SCRIPT_DIR/restart-luohuo-ws.sh" restart
