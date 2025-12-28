#!/bin/bash
# HomeOS Auto-Update Wrapper
# This script is called by the systemd timer and invokes the unified deploy script
exec "$(dirname "$0")/deploy.sh" --auto
