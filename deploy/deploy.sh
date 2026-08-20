#!/bin/bash
# InsureTrack Production Deployment Script for Ubuntu
# Run as root or with sudo

set -e

echo "=== InsureTrack Deployment ==="

APP_USER="www-data"
APP_DIR="/var/www/insuretrack"
REPO_DIR="$(pwd)"

# 1. System dependencies
echo "[1/8] Installing system dependencies..."
apt update && apt install -y \
    python3.12 python3.12-venv python3-pip \
    nginx certbot python3-certbot-nginx \
    postgresql postgresql-contrib \
    supervisor

# 2. Create app directory
echo "[2/8] Setting up application directory..."
mkdir -p "$APP_DIR/backend/logs" "$APP_DIR/frontend/dist"
chown -R $APP_USER:$APP_USER "$APP_DIR"

# 3. Copy files
echo "[3/8] Deploying application files..."
cp -r "$REPO_DIR/backend/"* "$APP_DIR/backend/"
cp -r "$REPO_DIR/frontend/dist/"* "$APP_DIR/frontend/dist/"

# 4. Python environment
echo "[4/8] Setting up Python environment..."
python3.12 -m venv "$APP_DIR/backend/venv"
"$APP_DIR/backend/venv/bin/pip" install --upgrade pip
"$APP_DIR/backend/venv/bin/pip" install -r "$APP_DIR/backend/requirements.txt"

# 5. Environment file
echo "[5/8] Configuring environment..."
if [ ! -f "$APP_DIR/backend/.env" ]; then
    echo "WARNING: No .env file found. Copy your .env to $APP_DIR/backend/.env"
    echo "Generate secrets with:"
    echo "  python3 -c \"import secrets; print('SECRET_KEY=' + secrets.token_hex(32))\""
    echo "  python3 -c \"import secrets; print('JWT_SECRET_KEY=' + secrets.token_hex(32))\""
fi

# 6. Database setup
echo "[6/8] Database is managed by Supabase (remote PostgreSQL)."
echo "       Ensure DATABASE_URL is set in .env"

# 7. Nginx
echo "[7/8] Configuring Nginx..."
cp "$REPO_DIR/deploy/nginx/insuretrack.conf" /etc/nginx/sites-available/insuretrack
ln -sf /etc/nginx/sites-available/insuretrack /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 8. Systemd service
echo "[8/8] Setting up systemd service..."
cp "$REPO_DIR/deploy/systemd/insuretrack.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable insuretrack
systemctl restart insuretrack

# 9. SSL with Let's Encrypt (optional)
echo ""
echo "=== To enable HTTPS with Let's Encrypt ==="
echo "  sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com"
echo ""
echo "=== Deployment complete ==="
echo "  Backend:  systemctl status insuretrack"
echo "  Nginx:    systemctl status nginx"
echo "  Logs:     tail -f $APP_DIR/backend/logs/insuretrack.log"
echo ""
echo "  Default login: admin@insurance.com / admin123"
