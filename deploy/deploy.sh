#!/bin/bash
# InsureTrack Production Deployment Script for Ubuntu 24.04
# Run as root or with sudo, from the repository root (workspace root).
# Designed for IP-first (HTTP) deployment without a domain.

set -e

APP_DIR="/var/www/insuretrack"
REPO_DIR="$(pwd)"

echo "=== InsureTrack Deployment ==="

# 1. System dependencies
echo "[1/9] Installing system dependencies..."
apt update && apt install -y \
    python3.12 python3.12-venv python3-pip \
    nginx certbot python3-certbot-nginx \
    redis-server \
    git curl ufw build-essential libpq-dev \
    postgresql postgresql-contrib

# 2. App directories
echo "[2/9] Setting up application directory..."
mkdir -p "$APP_DIR/backend/logs" "$APP_DIR/frontend/dist" "$APP_DIR/backups"
chown -R deploy:www-data "$APP_DIR"

# 3. Copy backend (exclude local-only artifacts)
echo "[3/9] Deploying backend files..."
tar -C "$REPO_DIR/backend" \
    --exclude='venv' --exclude='.env' --exclude='.env.example' \
    --exclude='instance' --exclude='__pycache__' --exclude='.pytest_cache' \
    --exclude='insurance.db' --exclude='nul' --exclude='tests' \
    -cf - . | tar -C "$APP_DIR/backend" -xf -
chown -R deploy:www-data "$APP_DIR/backend"

# 4. Copy frontend build (REQUIRES npm run build first)
echo "[4/9] Deploying frontend build..."
if [ -d "$REPO_DIR/frontend/dist" ]; then
    cp -r "$REPO_DIR/frontend/dist/"* "$APP_DIR/frontend/dist/"
    chown -R deploy:www-data "$APP_DIR/frontend/dist"
else
    echo "WARNING: frontend/dist not found. Build it first with: (cd frontend && npm run build)"
fi

# 5. Python environment
echo "[5/9] Setting up Python environment..."
python3.12 -m venv "$APP_DIR/backend/venv"
"$APP_DIR/backend/venv/bin/pip" install --upgrade pip
"$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# 6. Environment file
echo "[6/9] Environment..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo "WARNING: No .env found. Create $APP_DIR/backend/.env with:"
    echo '  SECRET_KEY=<64 hex>  JWT_SECRET_KEY=<64 hex>  DATABASE_URL=postgresql://<user>:<pass>@127.0.0.1:5432/insuretrack'
    echo '  REDIS_URL=redis://localhost:6379/0  FLASK_ENV=production  FLASK_DEBUG=false'
    echo '  FORCE_HTTPS=false  SESSION_COOKIE_SECURE=false  CORS_ORIGINS=http://<SERVER_IP>'
fi

# 7. Nginx (IP-first HTTP config)
echo "[7/9] Configuring Nginx..."
cp "$REPO_DIR/deploy/nginx/insuretrack.conf" /etc/nginx/sites-available/insuretrack
ln -sf /etc/nginx/sites-available/insuretrack /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 8. Systemd service
echo "[8/9] Setting up systemd service..."
cp "$REPO_DIR/deploy/systemd/insuretrack.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable insuretrack
systemctl restart insuretrack

# 9. Firewall
echo "[9/9] Configuring firewall..."
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo ""
echo "=== Deployment complete ==="
echo "  Backend:  systemctl status insuretrack"
echo "  Nginx:    systemctl status nginx"
echo "  Logs:     tail -f $APP_DIR/backend/logs/insuretrack.log"
echo ""
echo "  Schema is applied via Alembic automatically on backend startup."
echo "  To HTTPS later: point a domain here, then:"
echo "    cp deploy/nginx/insuretrack-https.conf /etc/nginx/sites-available/insuretrack"
echo "    certbot --nginx -d yourdomain.com -d www.yourdomain.com"