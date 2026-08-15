#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
# shellcheck source=common.sh
. "$SCRIPT_DIR/common.sh"

"$SCRIPT_DIR/up.sh"
"$SCRIPT_DIR/verify-runtime.sh"

printf '%s\n' 'MODULE 1 REPAIRED'
