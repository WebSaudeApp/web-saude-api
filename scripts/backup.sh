#!/usr/bin/env sh
set -eu
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env"
BACKUP_DIR="$ROOT/backups"

if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    value=$(printf '%s' "$value" | sed 's/^["'\'']//;s/["'\'']$//')
    eval "export ${key}=\${${key}:-$value}"
  done < "$ENV_FILE"
fi

if [ -z "${DIRECT_URL:-}" ]; then
  echo "DIRECT_URL não definido. Preencha o .env." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/websaude-$STAMP.dump"
pg_dump "$DIRECT_URL" --format=custom --file "$OUT"
echo "Backup gravado em $OUT"
