#!/usr/bin/env bash
# ClassClicker installer for a fresh Tencent Cloud CVM/Lighthouse server.
# Supported OS: Ubuntu 22.04 LTS / 24.04 LTS.
# See docs/TENCENT_CLOUD_SERVER_DEPLOYMENT.md before running.
set -Eeuo pipefail

APP_NAME="classroom-clicker"
umask 077
APP_USER="classclicker"
APP_GROUP="classclicker"
APP_DIR="/opt/classroom-clicker"
DATA_DIR="/var/lib/classroom-clicker"
UPLOAD_DIR="${DATA_DIR}/uploads"
ENV_DIR="/etc/classroom-clicker"
ENV_FILE="${ENV_DIR}/app.env"
SERVICE_FILE="/etc/systemd/system/classroom-clicker.service"
NGINX_FILE="/etc/nginx/sites-available/classroom-clicker"
DEPLOY_KEY="/root/.ssh/classroom-clicker-deploy"
BACKUP_DIR="/var/backups/classroom-clicker"
REPO_URL="${APP_REPO_URL:-}"
BRANCH="${APP_BRANCH:-main}"
DB_NAME="classroom_clicker"
DB_USER="classroom_clicker_app"
PORT="3000"
DOMAIN=""
TLS_EMAIL=""
SETUP_GITHUB_KEY=0

log() { printf '\n[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }
usage() {
  cat <<'EOF'
Usage:
  sudo bash deploy-tencent-cloud.sh --setup-github-key
  sudo bash deploy-tencent-cloud.sh --repo git@github.com:owner/repo.git --domain app.example.com --email admin@example.com [--branch main]

Options:
  --setup-github-key  Create/show a read-only GitHub Deploy Key, then exit.
  --domain DOMAIN     Public DNS name already pointed to this CVM.
  --email EMAIL       Let's Encrypt certificate/renewal contact email.
  --repo URL          Trusted Git repository URL (required for installation; may use APP_REPO_URL).
  --branch NAME       Git branch to deploy (default: main).
  -h, --help          Show this help.

The installer does not guess a repository, open MySQL to the Internet, reset an existing
database password, run drizzle --force, or change Tencent Cloud firewall/security-group rules.
EOF
}

while (($#)); do
  case "$1" in
    --setup-github-key) SETUP_GITHUB_KEY=1; shift ;;
    --domain) [[ $# -ge 2 ]] || die "--domain requires a value"; DOMAIN="$2"; shift 2 ;;
    --email) [[ $# -ge 2 ]] || die "--email requires a value"; TLS_EMAIL="$2"; shift 2 ;;
    --repo) [[ $# -ge 2 ]] || die "--repo requires a value"; REPO_URL="$2"; shift 2 ;;
    --branch) [[ $# -ge 2 ]] || die "--branch requires a value"; BRANCH="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $1" ;;
  esac
done

[[ "$EUID" -eq 0 ]] || die "Run this script as root (sudo)."

prepare_github_deploy_key() {
  install -d -m 0700 /root/.ssh
  if [[ ! -f "$DEPLOY_KEY" ]]; then
    ssh-keygen -q -t ed25519 -N '' -C "classroom-clicker-cvm-readonly" -f "$DEPLOY_KEY"
    chmod 0600 "$DEPLOY_KEY"
    chmod 0644 "${DEPLOY_KEY}.pub"
  fi
  printf '\nAdd this public key in GitHub → repository Settings → Deploy keys.\n'
  printf 'Use a descriptive title and leave “Allow write access” unchecked.\n\n'
  cat "${DEPLOY_KEY}.pub"
  printf '\nAfter adding it, rerun this script with --domain and --email.\n'
}

if [[ "$SETUP_GITHUB_KEY" -eq 1 ]]; then
  command -v ssh-keygen >/dev/null || { apt-get update -y && apt-get install -y openssh-client; }
  prepare_github_deploy_key
  exit 0
fi

[[ -n "$REPO_URL" ]] || die "A trusted repository is required via --repo or APP_REPO_URL; refusing to fall back to another source."
[[ -n "$DOMAIN" ]] || { usage >&2; die "A domain is required. Point its DNS A record to this server first."; }
[[ -n "$TLS_EMAIL" && "$TLS_EMAIL" == *@* ]] || die "Provide a valid --email for Let's Encrypt certificate renewal notices."
[[ "$DOMAIN" =~ ^([A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$ ]] || die "--domain must be a DNS hostname (not a URL or IP address)."
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]+$ ]] || die "Invalid branch name."

[[ -r /etc/os-release ]] || die "Cannot identify the operating system."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "ubuntu" && "${VERSION_ID:-}" =~ ^(22\.04|24\.04)(\.|$) ]] || die "Use Ubuntu 22.04 LTS or 24.04 LTS on a fresh Tencent Cloud CVM."

log "Installing system packages (this may take several minutes)."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git openssh-client openssl build-essential nginx mariadb-server certbot python3-certbot-nginx

if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' 2>/dev/null; then
  log "Installing Node.js 22 from the NodeSource Ubuntu repository."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
npm install --global pnpm@10.19.0
systemctl enable --now mariadb nginx

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --user-group --create-home --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_GROUP" -m 0750 "$APP_DIR" "$DATA_DIR" "$UPLOAD_DIR"

# Private GitHub repositories require the read-only deploy key created by --setup-github-key.
if [[ "$REPO_URL" == git@github.com:* || "$REPO_URL" == ssh://git@github.com/* ]]; then
  if [[ ! -f "$DEPLOY_KEY" ]]; then
    prepare_github_deploy_key
    die "Add the public key above as a read-only GitHub Deploy Key, then rerun."
  fi
  export GIT_SSH_COMMAND="ssh -i ${DEPLOY_KEY} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
fi
if ! git ls-remote "$REPO_URL" "refs/heads/${BRANCH}" >/dev/null 2>&1; then
  [[ -f "${DEPLOY_KEY}.pub" ]] && { printf '\nGitHub has not authorized this deploy key yet. Add this public key under repository Settings → Deploy keys:\n'; cat "${DEPLOY_KEY}.pub"; }
  die "Cannot read ${REPO_URL} branch ${BRANCH}. Check repository access, deploy key, and branch name."
fi

if [[ -d "${APP_DIR}/.git" ]]; then
  [[ -z "$(git -C "$APP_DIR" status --porcelain)" ]] || die "${APP_DIR} has local changes; refusing to overwrite them. Back them up or clean the worktree first."
  CURRENT_BRANCH="$(git -C "$APP_DIR" branch --show-current)"
  [[ "$CURRENT_BRANCH" == "$BRANCH" ]] || die "Checked-out branch is ${CURRENT_BRANCH}; switch it to ${BRANCH} manually before rerunning."
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" pull --ff-only origin "$BRANCH"
else
  [[ -z "$(find "$APP_DIR" -mindepth 1 -maxdepth 1 -print -quit)" ]] || die "${APP_DIR} is not empty and is not a Git checkout; refusing to overwrite it."
  GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o StrictHostKeyChecking=accept-new}" git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi
chown -R "${APP_USER}:${APP_GROUP}" "$APP_DIR"

FIRST_INSTALL=0
if [[ ! -f "$ENV_FILE" ]]; then
  FIRST_INSTALL=1
  if mariadb -Nse "SHOW DATABASES LIKE '${DB_NAME}'" | grep -Fxq "$DB_NAME"; then
    die "Database ${DB_NAME} already exists but ${ENV_FILE} does not. Refusing to overwrite/adopt existing data; back it up and configure manually."
  fi
  DB_PASSWORD="$(openssl rand -hex 32)"
  CLASSCLICKER_SESSION_SECRET="$(openssl rand -hex 48)"
  DATABASE_URL="mysql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:3306/${DB_NAME}"
  install -d -o root -g "$APP_GROUP" -m 0750 "$ENV_DIR"
  cat > "${ENV_FILE}.new" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=${PORT}
DATABASE_URL=${DATABASE_URL}
CLASSCLICKER_SESSION_SECRET=${CLASSCLICKER_SESSION_SECRET}
APP_BASE_URL=https://${DOMAIN}
FILE_STORAGE_DIR=${UPLOAD_DIR}
CLASSCLICKER_STORAGE_BACKEND=filesystem
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_SES_REGION=ap-hongkong
SENDER_EMAIL=
EOF
  install -o root -g "$APP_GROUP" -m 0640 "${ENV_FILE}.new" "$ENV_FILE"
  rm -f "${ENV_FILE}.new"
  mariadb <<SQL
CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
else
  CURRENT_BASE_URL="$(sed -n 's/^APP_BASE_URL=//p' "$ENV_FILE" | head -n 1)"
  [[ "$CURRENT_BASE_URL" == "https://${DOMAIN}" ]] || die "Existing ${ENV_FILE} has APP_BASE_URL=${CURRENT_BASE_URL}; update domain/TLS manually rather than silently replacing production config."
fi

DATABASE_URL="$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -n 1)"
[[ "$DATABASE_URL" == mysql://* ]] || die "DATABASE_URL is missing or invalid in ${ENV_FILE}."

log "Installing locked dependencies and building production assets."
sudo -u "$APP_USER" env PATH="/usr/local/bin:/usr/bin:/bin" pnpm --dir "$APP_DIR" install --frozen-lockfile
sudo -u "$APP_USER" env PATH="/usr/local/bin:/usr/bin:/bin" NODE_ENV=production pnpm --dir "$APP_DIR" build

SCHEMA_MARKER="${DATA_DIR}/.schema-initialized"
if [[ ! -f "$SCHEMA_MARKER" ]]; then
  [[ "$FIRST_INSTALL" -eq 1 ]] || die "Schema initialization marker is missing for an existing install. Inspect/backup the DB and reconcile its migration history before running pnpm db:migrate manually; this script will not alter an existing DB."
  log "Applying the checked-in Drizzle baseline to the new, empty MariaDB database."
  sudo -u "$APP_USER" env PATH="/usr/local/bin:/usr/bin:/bin" DATABASE_URL="$DATABASE_URL" pnpm --dir "$APP_DIR" db:migrate
  install -o "$APP_USER" -g "$APP_GROUP" -m 0640 /dev/null "$SCHEMA_MARKER"
else
  log "Existing database preserved; no automatic schema changes were applied."
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ClassClicker web application
After=network-online.target mariadb.service
Wants=network-online.target
Requires=mariadb.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=$(command -v pnpm) start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}
UMask=0027

[Install]
WantedBy=multi-user.target
EOF
chmod 0644 "$SERVICE_FILE"

if [[ -f "$NGINX_FILE" ]]; then
  cp -a "$NGINX_FILE" "${NGINX_FILE}.backup.$(date +%Y%m%d%H%M%S)"
fi
cat > "$NGINX_FILE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    client_max_body_size 55m;

    location ^~ /api/storage/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
EOF
ln -sfn "$NGINX_FILE" /etc/nginx/sites-enabled/classroom-clicker
nginx -t

# Daily on-server backups of MariaDB and uploads; keep 14 days. Also keep a copy off-server.
install -d -o root -g root -m 0700 "$BACKUP_DIR"
cat > /usr/local/sbin/backup-classroom-clicker <<'BACKUP'
#!/usr/bin/env bash
set -Eeuo pipefail
BACKUP_DIR="/var/backups/classroom-clicker"
DATA_DIR="/var/lib/classroom-clicker"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_DIR="$(mktemp -d "${BACKUP_DIR}/.tmp.XXXXXX")"
cleanup() { [[ -d "$TMP_DIR" ]] && rm -rf -- "$TMP_DIR"; }
trap cleanup EXIT
mariadb-dump --single-transaction --quick classroom_clicker | gzip -1 > "${TMP_DIR}/database.sql.gz"
tar -C "$DATA_DIR" -czf "${TMP_DIR}/uploads.tar.gz" uploads
gzip -t "${TMP_DIR}/database.sql.gz"
tar -tzf "${TMP_DIR}/uploads.tar.gz" >/dev/null
mv "$TMP_DIR" "${BACKUP_DIR}/${STAMP}"
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name '20*' -mtime +14 -exec rm -rf -- {} +
trap - EXIT
printf 'Backup completed: %s/%s\n' "$BACKUP_DIR" "$STAMP"
BACKUP
chmod 0750 /usr/local/sbin/backup-classroom-clicker
cat > /etc/systemd/system/classroom-clicker-backup.service <<'EOF'
[Unit]
Description=Back up ClassClicker database and persistent uploads
After=mariadb.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/backup-classroom-clicker
EOF
cat > /etc/systemd/system/classroom-clicker-backup.timer <<'EOF'
[Unit]
Description=Daily ClassClicker backup

[Timer]
OnCalendar=*-*-* 03:20:00
Persistent=true
RandomizedDelaySec=20m
Unit=classroom-clicker-backup.service

[Install]
WantedBy=timers.target
EOF
chmod 0644 /etc/systemd/system/classroom-clicker-backup.{service,timer}

systemctl daemon-reload
systemctl enable --now classroom-clicker
systemctl restart classroom-clicker
systemctl enable --now classroom-clicker-backup.timer
systemctl start classroom-clicker-backup.service
systemctl reload nginx

log "Checking public DNS before requesting the HTTPS certificate."
PUBLIC_IP="$(curl -4fsS --max-time 8 https://api.ipify.org 2>/dev/null || true)"
if [[ -n "$PUBLIC_IP" ]]; then
  DNS_IPS="$(getent ahostsv4 "$DOMAIN" | awk '{print $1}' | sort -u || true)"
  printf '%s\n' "$DNS_IPS" | grep -Fxq "$PUBLIC_IP" || die "DNS for ${DOMAIN} does not point to this CVM public IPv4 (${PUBLIC_IP}). Fix the A record and rerun."
else
  log "Could not determine public IPv4 automatically; verify the DNS A record points to this CVM before continuing."
fi
certbot --nginx --non-interactive --agree-tos --keep-until-expiring --redirect --email "$TLS_EMAIL" -d "$DOMAIN"

log "Checking application health."
curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused "http://127.0.0.1:${PORT}/healthz"
printf '\n'
curl --fail --silent --show-error --retry 5 --retry-delay 2 "https://${DOMAIN}/healthz"
printf '\n'

cat <<EOF

Deployment complete: https://${DOMAIN}
Application service: systemctl status ${APP_NAME}
Logs: journalctl -u ${APP_NAME} -f
Persistent uploads: ${UPLOAD_DIR}
Environment file: ${ENV_FILE} (root-owned, readable only by the app service group; keep secrets out of Git)
Daily local backups: ${BACKUP_DIR} (14-day retention; copy off-server for disaster recovery)

Before opening registration to real users, configure Tencent SES values in ${ENV_FILE},
then run: systemctl restart ${APP_NAME}
EOF
