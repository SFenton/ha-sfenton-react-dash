#!/bin/sh
set -eu

exec squid -N -f /opt/ha-dashboard/squid.conf
