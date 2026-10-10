#!/bin/sh
set -eu
file=/usr/share/nginx/html/demo/defaults.env
admin_email=${ERBAS_DEMO_ADMIN_EMAIL:-}
admin_password=${ERBAS_DEMO_ADMIN_PASSWORD:-}
user_email=${ERBAS_DEMO_USER_EMAIL:-}
user_password=${ERBAS_DEMO_USER_PASSWORD:-}
if [ -z "$admin_email$admin_password$user_email$user_password" ]; then
    rm -f "$file"
    exit 0
fi
cr=$(printf '\r')
lf='
'
for value in "$admin_email" "$admin_password" "$user_email" "$user_password"; do
    case "$value" in
        ''|*"$cr"*|*"$lf"*) echo 'ERROR: demo values must be nonempty and contain no CR/LF.' >&2; exit 1 ;;
    esac
done
[ "$admin_email" != "$user_email" ] || { echo 'ERROR: demo emails must differ.' >&2; exit 1; }
# Environment strings cannot contain NUL. This resource is public and demo-only.
mkdir -p "${file%/*}"
printf 'ERBAS_DEMO_ADMIN_EMAIL=%s\nERBAS_DEMO_ADMIN_PASSWORD=%s\nERBAS_DEMO_USER_EMAIL=%s\nERBAS_DEMO_USER_PASSWORD=%s\n' \
    "$admin_email" "$admin_password" "$user_email" "$user_password" > "$file"
