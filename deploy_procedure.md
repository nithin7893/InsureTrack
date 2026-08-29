# InsureTrack — Complete Deployment Procedure for Utho Cloud

> **Target:** Deploy InsureTrack (React + Flask + Local PostgreSQL) to a Utho Cloud Ubuntu server  
> **Prerequisites:** Utho Cloud account, SSH client (Terminal / PowerShell / PuTTY).  
> A domain name is **optional** — you can deploy over HTTP using the server IP first and add a domain + HTTPS later (see Phase 7 temp config).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [PHASE 1 — Create Utho Server](#2-phase-1--create-utho-server)
3. [PHASE 2 — Initial Server Setup](#3-phase-2--initial-server-setup)
4. [PHASE 3 — Install PostgreSQL](#4-phase-3--install-postgresql)
5. [PHASE 4 — Transfer Application to Server](#5-phase-4--transfer-application-to-server)
6. [PHASE 5 — Deploy Backend](#6-phase-5--deploy-backend)
7. [PHASE 6 — Deploy Frontend](#7-phase-6--deploy-frontend)
8. [PHASE 7 — Configure Nginx](#8-phase-7--configure-nginx)
9. [PHASE 8 — Configure systemd Service](#9-phase-8--configure-systemd-service)
10. [PHASE 9 — Domain & DNS Setup](#10-phase-9--domain--dns-setup)
11. [PHASE 10 — SSL/HTTPS with Let's Encrypt](#11-phase-10--sslhttps-with-lets-encrypt)
12. [PHASE 11 — Production Security Hardening](#12-phase-11--production-security-hardening)
13. [PHASE 12 — Testing & Verification](#13-phase-12--testing--verification)
14. [PHASE 13 — Maintenance & Operations](#14-phase-13--maintenance--operations)
15. [Appendix A — Full Server File Layout](#15-appendix-a--full-server-file-layout)
16. [Appendix B — Environment Variable Reference](#16-appendix-b--environment-variable-reference)
17. [Appendix C — Troubleshooting](#17-appendix-c--troubleshooting)
18. [Appendix D — Production Architecture Diagram](#18-appendix-d--production-architecture-diagram)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                    Utho Cloud Server                      │
│                  Ubuntu 24.04 LTS                        │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │                     Nginx                          │  │
│  │                 (Ports 80/443)                     │  │
│  │              SSL Termination                       │  │
│  │                                                    │  │
│  │    /            → /var/www/insuretrack/frontend/   │  │
│  │    /api/*       → 127.0.0.1:5000 (Gunicorn)       │  │
│  └──────────┬─────────────────┬──────────────────────┘  │
│             │                 │                          │
│             ▼                 ▼                          │
│  ┌──────────────┐   ┌──────────────────────────────┐   │
│  │   Frontend   │   │         Backend               │   │
│  │ React+Vite   │   │   Flask + Gunicorn            │   │
│  │ Static Files │   │   (127.0.0.1:5000)            │   │
│  │              │   │   5 Worker Processes           │   │
│  └──────────────┘   └──────────────┬───────────────┘   │
│                                     │                   │
│                                     ▼                   │
│                         ┌──────────────────────┐        │
│                         │   PostgreSQL 16       │        │
│                         │   (localhost:5432)    │        │
│                         │   Database: insuretrack│       │
│                         └──────────────────────┘        │
└──────────────────────────────────────────────────────────┘
```

| Component | Port | Access |
|-----------|------|--------|
| Nginx HTTP | 80 | Public → redirects to HTTPS |
| Nginx HTTPS | 443 | Public |
| Gunicorn | 5000 | Localhost only (via Nginx) |
| PostgreSQL | 5432 | Localhost only |

---

## 2. PHASE 1 — Create Utho Server

### Step 1.1 — Create the Compute Instance

1. Log in to the [Utho Cloud Console](https://console.utho.com)
2. Navigate to **Compute → Instances → Create Instance**
3. Configure:
   - **OS:** Ubuntu 24.04 LTS
   - **Plan:** 2 vCPU / 4 GB RAM / 80 GB EBS
   - **Region:** Choose closest to your users
   - **Authentication:** SSH Keys (register your public key, e.g. `Insre2`)
   - **Hostname:** `InsureTrack-pro`
4. Click **Create** and wait for the instance to become active
5. Note the **Public IP address** — you will need it for every step below

> **In this guide, replace `<SERVER_IP>` with your actual Utho server IP.**

### Step 1.2 — Add Your Domain's DNS Records

Before connecting, set up DNS so you can verify later:

| Record Type | Host | Value | TTL |
|-------------|------|-------|-----|
| A | `@` | `<SERVER_IP>` | 300 |
| A | `www` | `<SERVER_IP>` | 300 |

> Replace `yourdomain.com` with your actual domain throughout this guide.

---

## 3. PHASE 2 — Initial Server Setup

> **All commands in this phase run ON THE UTHO SERVER via SSH.**

### Step 2.1 — Connect via SSH

**On your local computer:**

```bash
ssh root@<SERVER_IP>
```

If you use SSH-key authentication (recommended), the private key must be available on your local machine. For example, on Windows:

```powershell
ssh -i "$env:USERPROFILE\.ssh\Insre2" root@<SERVER_IP>
```

> **Actual server:** `ssh -i "$env:USERPROFILE\.ssh\Insre2" root@103.127.31.222`  
> Keep the private key **only** on your local computer — never upload it to GitHub or the server.

### Step 2.2 — Update System Packages

```bash
apt update && apt upgrade -y
```

### Step 2.3 — Set Timezone

```bash
timedatectl set-timezone Asia/Kolkata
```

### Step 2.4 — Install Required Packages

```bash
apt install -y \
    python3.12 python3.12-venv python3-pip \
    nginx \
    certbot python3-certbot-nginx \
    redis-server \
    git \
    curl \
    ufw \
    build-essential \
    libpq-dev
```

**What each package does:**
- `python3.12` — Python runtime for Flask backend
- `python3.12-venv` — Virtual environment support
- `nginx` — Web server / reverse proxy
- `certbot` — Free SSL certificates from Let's Encrypt
- `redis-server` — Redis backing for Flask-Limiter rate limiting (production)
- `git` — Version control
- `build-essential`, `libpq-dev` — Required to compile `psycopg2-binary`

### Step 2.5 — Verify Python

```bash
python3.12 --version
```

Expected output: `Python 3.12.x`

### Step 2.6 — Create Deployment User

```bash
useradd -m -s /bin/bash deploy
usermod -aG www-data deploy
```

### Step 2.7 — Create Application Directory Structure

```bash
mkdir -p /var/www/insuretrack/backend/logs
mkdir -p /var/www/insuretrack/frontend/dist
chown -R deploy:www-data /var/www/insuretrack
```

### Step 2.8 — Configure Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Type `y` when prompted. Verify with:

```bash
ufw status
```

Expected output should show ports 22, 80, 443 open.

### Step 2.9 — Start and Enable Redis

Redis backs the production rate limiter (Flask-Limiter). Run on the server:

```bash
systemctl start redis-server
systemctl enable redis-server
redis-cli ping
```

Expected output for `redis-cli ping`:

```
PONG
```

---

## 4. PHASE 3 — Install PostgreSQL

> **PostgreSQL runs locally on the Utho server, not remote Supabase.**

### Step 3.1 — Install PostgreSQL

```bash
apt install -y postgresql postgresql-contrib
```

### Step 3.2 — Start and Enable PostgreSQL

```bash
systemctl start postgresql
systemctl enable postgresql
systemctl status postgresql
```

### Step 3.3 — Create Database and User

```bash
sudo -u postgres psql
```

You will see a `postgres=#` prompt. Run these SQL commands:

```sql
-- Create a dedicated user for InsureTrack
CREATE USER insuretrack_user1 WITH PASSWORD 'InsureTrack_Secure_P@ssw0rd_2026';

-- Create the database
CREATE DATABASE insuretrack OWNER insuretrack_user1;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE insuretrack TO insuretrack_user1;

-- Exit
\q
```

> **IMPORTANT:** Replace `InsureTrack_Secure_P@ssw0rd_2026` with your own strong password. Save it — you will need it for the `.env` file.

### Step 3.4 — Configure PostgreSQL Authentication

Edit the `pg_hba.conf` file to allow the deploy user to connect:

```bash
# Find the pg_hba.conf path
PG_HBA=$(sudo -u postgres psql -t -P format=unaligned -c 'SHOW hba_file')
echo $PG_HBA
```

It will be something like `/etc/postgresql/16/main/pg_hba.conf`. Then edit it:

```bash
nano $PG_HBA
```

Add this line before the `host all all 127.0.0.1/32 scram-sha-256` line:

```
local   insuretrack   insuretrack_user1                              scram-sha-256
host    insuretrack   insuretrack_user1   127.0.0.1/32                scram-sha-256
```

Save and exit (`Ctrl+O`, `Enter`, `Ctrl+X`).

### Step 3.5 — Restart PostgreSQL

```bash
systemctl restart postgresql
```

### Step 3.6 — Test Database Connection

```bash
psql -U insuretrack_user1 -d insuretrack -h 127.0.0.1 -c "SELECT 1;"
```

Enter the password you created. Expected output:

```
 ?column?
----------
        1
(1 row)
```

> **On the server, press Ctrl+D or type `\q` to exit psql.**

### Step 3.7 — Set the Database Password (as postgres user)

If the password-based login didn't work, set it explicitly:

```bash
sudo -u postgres psql -c "ALTER USER insuretrack_user1 WITH PASSWORD 'YourPasswordHere';"
```

---

## 5. PHASE 4 — Transfer Application to Server

> **This section has commands you run on your LOCAL COMPUTER and commands on the SERVER.**

### Step 4.1 — Build Frontend Locally

**On your LOCAL computer** (in your project root `D:\InsureTrack`):

```bash
cd frontend
npm install
npm run build
cd ..
```

This creates production files in `frontend/dist/`.

### Step 4.2 — Transfer Files to Server

**On your LOCAL computer:**

```bash
# Transfer backend
scp -r backend/ root@<SERVER_IP>:/tmp/insuretrack-backend/

# Transfer frontend build output
scp -r frontend/dist/ root@<SERVER_IP>:/tmp/insuretrack-frontend-dist/

# Transfer deployment config files
scp -r deploy/ root@<SERVER_IP>:/tmp/insuretrack-deploy/
```

> **If you get a "connection refused" error, make sure SSH is allowed through the firewall and you're using the correct IP and port.**

### Step 4.3 — Organize Files on Server

**On the Utho server (as root):**

```bash
# Copy backend to production directory
cp -r /tmp/insuretrack-backend/* /var/www/insuretrack/backend/

# Copy frontend build to production directory
cp -r /tmp/insuretrack-frontend-dist/* /var/www/insuretrack/frontend/dist/

# Set ownership
chown -R deploy:www-data /var/www/insuretrack

# Verify
ls -la /var/www/insuretrack/backend/
ls -la /var/www/insuretrack/frontend/dist/
```

Expected backend directory should contain: `app.py`, `models.py`, `gunicorn.conf.py`, `requirements.txt`, `routes/`, `utils/`, `migrations/`, `logs/`.

Expected frontend dist should contain: `index.html`, `favicon.svg`, `icons.svg`, `assets/`.

---

## 6. PHASE 5 — Deploy Backend

> **All commands in this section run ON THE UTHO SERVER.**

### Step 5.1 — Create Python Virtual Environment

```bash
# Switch to deploy user
su - deploy

# Create virtual environment
python3.12 -m venv /var/www/insuretrack/backend/venv

# Activate it
source /var/www/insuretrack/backend/venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install all Python dependencies
pip install -r /var/www/insuretrack/backend/requirements.txt

# Verify gunicorn is installed
gunicorn --version
```

Expected output: `gunicorn version 23.0.0`

```bash
# Deactivate and exit deploy user
deactivate
exit
```

### Step 5.2 — Generate Production Secret Keys

```bash
# Run as root
SECRET_KEY=$(python3.12 -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=$(python3.12 -c "import secrets; print(secrets.token_hex(32))")

# Display them — COPY THESE VALUES
echo "SECRET_KEY=$SECRET_KEY"
echo "JWT_SECRET_KEY=$JWT_SECRET_KEY"
```

**SAVE BOTH VALUES. You will need them in the next step.**

### Step 5.3 — Create Production .env File

```bash
cat > /var/www/insuretrack/backend/.env << 'EOF'
# ============================================
# InsureTrack Production Environment Variables
# ============================================

# Flask Security Keys (generated in Step 5.2)
SECRET_KEY=<paste-your-generated-secret-key-here>
JWT_SECRET_KEY=<paste-your-generated-jwt-secret-key-here>

# Database (local PostgreSQL on this server)
DATABASE_URL=postgresql://insuretrack_user1:<paste-your-db-password>@127.0.0.1:5432/insuretrack
DB_POOL_SIZE=10
DB_POOL_RECYCLE=300
DB_MAX_OVERFLOW=20

# JWT Token Configuration
JWT_ACCESS_MINUTES=30
JWT_REFRESH_DAYS=30

# CORS — {domain}: only your production domain; {IP}: http://103.127.31.222 (no-domain, HTTP)
CORS_ORIGINS=https://yourdomain.com,http://yourdomain.com

# Redis (REQUIRED for production rate limiting — installed in Step 2.9)
REDIS_URL=redis://localhost:6379/0

# Security — MUST be true in production (with a domain + HTTPS)
FORCE_HTTPS=true
SESSION_COOKIE_SECURE=true
MAX_CONTENT_LENGTH_MB=5

# Logging
LOG_LEVEL=INFO

# Flask — production mode (prevents demo seed data)
FLASK_DEBUG=false
FLASK_ENV=production
EOF
```

> **IMPORTANT: Replace these values before saving:**
> - `<paste-your-generated-secret-key-here>` → the SECRET_KEY from Step 5.2
> - `<paste-your-generated-jwt-secret-key-here>` → the JWT_SECRET_KEY from Step 5.2
> - `<paste-your-db-password>` → the PostgreSQL password you created in Step 3.3
> - `yourdomain.com` → your actual domain name

> **No domain yet (IP-first HTTP deploy):** if you are using the temporary IP-based Nginx config from Phase 7, set these instead:
>
> ```bash
> CORS_ORIGINS=http://103.127.31.222
> FORCE_HTTPS=false
> SESSION_COOKIE_SECURE=false
> ```
>
> Revert both to `true` (and set `CORS_ORIGINS=https://yourdomain.com`) once HTTPS is live.

> **Schema migrations:** database schema is applied automatically on startup via **Alembic** (`migrations/`) in production. You can also run it manually:
>
> ```bash
> cd /var/www/insuretrack/backend && source venv/bin/activate
> alembic upgrade head
> deactivate
> ```

### Step 5.4 — Secure the .env File

```bash
chown deploy:www-data /var/www/insuretrack/backend/.env
chmod 640 /var/www/insuretrack/backend/.env
```

### Step 5.5 — Create Required Directories

```bash
mkdir -p /var/www/insuretrack/backend/logs
chown -R deploy:www-data /var/www/insuretrack/backend/logs
```

### Step 5.6 — Test Backend Manually

```bash
# Switch to deploy user
su - deploy

# Test that Flask app starts without errors
cd /var/www/insuretrack/backend
source venv/bin/activate

# Quick test — start Flask in dev mode briefly
timeout 10 python -c "
from app import create_app
app = create_app()
print('Flask app created successfully')
" 2>&1 || true

# Exit deploy user
exit
```

If you see `Flask app created successfully`, the backend is configured correctly.

If you see errors, check:
- The `.env` file has correct values
- PostgreSQL is running: `systemctl status postgresql`
- The database user can connect: `psql -U insuretrack_user1 -d insuretrack -h 127.0.0.1`

---

## 7. PHASE 6 — Deploy Frontend

> **Frontend is just static files served by Nginx. No runtime process needed.**

### Step 6.1 — Verify Build Files Exist

```bash
ls -la /var/www/insuretrack/frontend/dist/
ls -la /var/www/insuretrack/frontend/dist/assets/
```

You should see `index.html`, `favicon.svg`, `icons.svg`, and the `assets/` directory with JS and CSS files.

### Step 6.2 — Set Correct Permissions

```bash
chown -R deploy:www-data /var/www/insuretrack/frontend/dist
chmod -R 755 /var/www/insuretrack/frontend/dist
```

### Step 6.3 — Verify Frontend .env (No Changes Needed)

The frontend uses `VITE_API_URL` empty (or unset), which means all API requests go to the same domain (yourdomain.com). Nginx will proxy `/api/*` to the backend. **No frontend `.env` file needs to be modified or deployed.**

---

## 8. PHASE 7 — Configure Nginx

> **Nginx serves the frontend and reverse-proxies API requests to Gunicorn.**

### Step 7.1 — Create Nginx Configuration

```bash
cat > /etc/nginx/sites-available/insuretrack << 'EOF'
upstream insuretrack {
    server 127.0.0.1:5000;
    keepalive 32;
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL certificates (Let's Encrypt — will be set up by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss application/atom+xml image/svg+xml;

    # Client body size limit
    client_max_body_size 5M;

    # Frontend static files
    location / {
        root /var/www/insuretrack/frontend/dist;
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API reverse proxy
    location /api/ {
        proxy_pass http://insuretrack;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_http_version 1.1;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;

        # Don't cache API responses
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    # Block access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Logging
    access_log /var/log/nginx/insuretrack_access.log;
    error_log /var/log/nginx/insuretrack_error.log;
}
EOF
```

> **CRITICAL: Replace `yourdomain.com` and `www.yourdomain.com` with your actual domain name.**

If you don't have a domain yet, create a temporary config for initial testing:

```bash
cat > /etc/nginx/sites-available/insuretrack << 'EOF'
upstream insuretrack {
    server 127.0.0.1:5000;
    keepalive 32;
}

server {
    listen 80;
    server_name _;

    client_max_body_size 5M;

    location / {
        root /var/www/insuretrack/frontend/dist;
        try_files $uri $uri/ /index.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    location /api/ {
        proxy_pass http://insuretrack;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_http_version 1.1;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location ~ /\. {
        deny all;
    }

    access_log /var/log/nginx/insuretrack_access.log;
    error_log /var/log/nginx/insuretrack_error.log;
}
EOF
```

### Step 7.2 — Enable the Site

```bash
# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Enable InsureTrack site
ln -sf /etc/nginx/sites-available/insuretrack /etc/nginx/sites-enabled/
```

### Step 7.3 — Test Nginx Configuration

```bash
nginx -t
```

Expected output:

```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

If there's an error, fix it before proceeding.

### Step 7.4 — Start Nginx

```bash
systemctl restart nginx
systemctl enable nginx
systemctl status nginx
```

---

## 9. PHASE 8 — Configure systemd Service

> **systemd manages the Gunicorn/Flask backend process.**

### Step 8.1 — Copy the Service File

```bash
cp /tmp/insuretrack-deploy/systemd/insuretrack.service /etc/systemd/system/
```

### Step 8.2 — Verify Service File Content

```bash
cat /etc/systemd/system/insuretrack.service
```

It should contain:

```ini
[Unit]
Description=InsureTrack Backend API
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=notify
notify_access=main
User=www-data
Group=www-data
WorkingDirectory=/var/www/insuretrack/backend
Environment="PATH=/var/www/insuretrack/backend/venv/bin"
EnvironmentFile=/var/www/insuretrack/backend/.env
ExecStart=/var/www/insuretrack/backend/venv/bin/gunicorn \
    --config gunicorn.conf.py \
    app:create_app()
ExecReload=/bin/kill -s HUP $MAINPID
ExecStop=/bin/kill -s TERM $MAINPID
Restart=on-failure
RestartSec=5
TimeoutStartSec=30
TimeoutStopSec=30

# Security hardening
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/www/insuretrack/backend/logs
NoNewPrivileges=true
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
```

### Step 8.3 — Reload systemd and Start Service

```bash
systemctl daemon-reload
systemctl enable insuretrack
systemctl start insuretrack
```

### Step 8.4 — Check Service Status

```bash
systemctl status insuretrack
```

Expected output should show `Active: active (running)`.

If it shows `failed`, check logs:

```bash
journalctl -u insuretrack --since "5 min ago" -n 50
```

### Step 8.5 — Common Service Commands

| Action | Command |
|--------|---------|
| Check status | `systemctl status insuretrack` |
| Restart | `systemctl restart insuretrack` |
| Stop | `systemctl stop insuretrack` |
| Start | `systemctl start insuretrack` |
| Graceful reload | `systemctl reload insuretrack` |
| View live logs | `journalctl -u insuretrack -f` |
| View recent logs | `journalctl -u insuretrack --since "1 hour ago"` |

---

## 10. PHASE 9 — Domain & DNS Setup

### Step 9.1 — Point Your Domain to the Server

Go to your domain registrar's DNS management panel and create:

| Record Type | Host/Name | Value | TTL |
|-------------|-----------|-------|-----|
| A | `@` (or root) | `<SERVER_IP>` | 300 |
| A | `www` | `<SERVER_IP>` | 300 |

### Step 9.2 — Wait for DNS Propagation

**On your local computer:**

```bash
# Check if DNS is pointing to your server
nslookup yourdomain.com
```

Wait until you see your server's IP. This typically takes 5-15 minutes but can take up to 48 hours.

### Step 9.3 — Verify DNS Before Proceeding

```bash
# This should return your server IP
dig yourdomain.com +short
```

> **Do NOT proceed to Step 10 (SSL) until DNS is fully propagated.**

---

## 11. PHASE 10 — SSL/HTTPS with Let's Encrypt

### Step 10.1 — Switch to HTTP-Only Temp Config (If Using SSL Config)

If you already have the SSL config from Step 7.1, certbot needs a working HTTP config first. If you used the HTTP-only temp config, skip to Step 10.2.

### Step 10.2 — Obtain SSL Certificate

```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
1. Enter your email address (for renewal notifications)
2. Agree to terms of service
3. Choose whether to redirect HTTP to HTTPS (choose **Yes / Redirect**)

Certbot will:
- Verify domain ownership
- Download the SSL certificate
- Automatically modify your Nginx config to use SSL
- Set up HTTP → HTTPS redirect

### Step 10.3 — Verify Automatic Renewal

```bash
# Check certbot renewal timer
systemctl status certbot.timer

# Test renewal (dry run)
certbot renew --dry-run
```

Both should work without errors. Certbot automatically renews certificates before they expire.

### Step 10.4 — Verify Nginx Config After Certbot

Certbot modified your Nginx config. Check it:

```bash
cat /etc/nginx/sites-available/insuretrack
```

It should now have the SSL directives. Test:

```bash
nginx -t
systemctl reload nginx
```

---

## 12. PHASE 11 — Production Security Hardening

### Step 11.1 — Disable Root SSH Login

> **⚠️ Do NOT do this yet.** This must happen ONLY after:
> 1. You configure SSH key access for `deploy`
> 2. You test `ssh deploy@<SERVER_IP>` from a **new** terminal window and it works
>
> Skipping the order risks permanently locking yourself out of the server.

**On your LOCAL computer:**

```bash
# Generate SSH key pair (if you don't have one)
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy public key to server (run as root: open ~deploy/.ssh and add the key)
ssh-copy-id deploy@<SERVER_IP>
```

**On the UTHO SERVER (as root) — first, ensure `deploy` has an authorized_keys file:**

```bash
mkdir -p /home/deploy/.ssh
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
```
(`ssh-copy-id deploy@<SERVER_IP>` from local adds your public key to it. If `ssh-copy-id` is unavailable on Windows, paste the public key manually into `/home/deploy/.ssh/authorized_keys`, then `chmod 600` it.)

**Test from a NEW terminal window (as deploy) BEFORE disabling root:**

```bash
ssh deploy@<SERVER_IP>
```

**Only after `deploy` login succeeds — disable root SSH:**

```bash
sed -i 's/#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart sshd
```

### Step 11.2 — Set Correct File Permissions

```bash
# Lock down .env
chmod 640 /var/www/insuretrack/backend/.env
chown deploy:www-data /var/www/insuretrack/backend/.env

# Ensure frontend is readable
chmod -R 755 /var/www/insuretrack/frontend/dist

# Logs directory writable by deploy
chmod 755 /var/www/insuretrack/backend/logs
chown deploy:www-data /var/www/insuretrack/backend/logs
```

### Step 11.3 — Verify .env is Not Accessible via Web

```bash
# Test — should return 403 Forbidden or 404
curl -I http://yourdomain.com/.env
```

Your Nginx config already blocks hidden files (`location ~ /\. { deny all; }`), so `.env` is protected.

### Step 11.4 — Security Checklist

| Item | Status | Command to Verify |
|------|--------|-------------------|
| Firewall enabled | ✅ | `ufw status` |
| Only ports 22,80,443 open | ✅ | `ufw status` |
| Root SSH disabled | ✅ | `grep PermitRootLogin /etc/ssh/sshd_config` |
| PostgreSQL not exposed to internet | ✅ | PostgreSQL listens on localhost only |
| Flask debug mode off | ✅ | `grep FLASK_DEBUG /var/www/insuretrack/backend/.env` |
| FLASK_ENV=production | ✅ | `grep FLASK_ENV /var/www/insuretrack/backend/.env` |
| FORCE_HTTPS=true | ✅ | `grep FORCE_HTTPS /var/www/insuretrack/backend/.env` |
| SESSION_COOKIE_SECURE=true | ✅ | `grep SESSION_COOKIE_SECURE /var/www/insuretrack/backend/.env` |
| .env permissions 640 | ✅ | `ls -la /var/www/insuretrack/backend/.env` |
| HTTPS active | ✅ | `curl -I https://yourdomain.com` |
| Hidden files blocked | ✅ | `curl -I http://yourdomain.com/.env` |
| Security headers present | ✅ | `curl -I https://yourdomain.com` (check for X-Frame-Options, etc.) |

---

## 13. PHASE 12 — Testing & Verification

> **Run each test and verify the expected output.**

### Test 1 — Server Connectivity

```bash
# From your LOCAL computer
ping -c 3 yourdomain.com
```

### Test 2 — Backend Health Check (via Nginx)

```bash
curl -s https://yourdomain.com/api/health
```

Expected: `{"database":"healthy","status":"healthy"}`

### Test 3 — Backend Health Check (direct)

```bash
# On the Utho server
curl -s http://127.0.0.1:5000/api/health
```

Expected: `{"database":"healthy","status":"healthy"}`

### Test 4 — Database Connectivity

```bash
# On the Utho server
psql -U insuretrack_user1 -d insuretrack -h 127.0.0.1 -c "SELECT 1;"
```

Enter the database password. Expected: `?column?` = `1`

### Test 5 — Frontend Loading

```bash
# Check HTTP response code
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/
```

Expected: `200`

### Test 6 — Frontend SPA Routing

```bash
# Any route should return 200 (serves index.html)
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/login
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/dashboard
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/policies
```

All should return `200`.

### Test 7 — API Through Nginx

```bash
curl -s -o /dev/null -w "%{http_code}" https://yourdomain.com/api/health
```

Expected: `200`

### Test 8 — Authentication

```bash
curl -s -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insurance.com","password":"admin123"}'
```

> **Note:** This will only work if you have created an admin user in the production database (see Step 8.6 in the seed data note below). If you set `FLASK_ENV=production`, demo users are NOT auto-created.

### Test 9 — HTTPS Certificate

```bash
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

Expected: Shows valid `notBefore` and `notAfter` dates.

### Test 10 — Nginx Configuration

```bash
nginx -t
```

Expected: `syntax is ok` and `test is successful`

### Test 11 — Gunicorn Process

```bash
ps aux | grep gunicorn
```

Expected: Multiple gunicorn processes (master + workers).

### Test 12 — systemd Service

```bash
systemctl status insuretrack --no-pager
journalctl -u insuretrack --since "10 min ago" --no-pager
```

### Test 13 — Application Logs

```bash
tail -20 /var/www/insuretrack/backend/logs/insuretrack.log
```

Should show successful startup message: `InsureTrack application started successfully`

### Test 14 — Create Initial Admin User (If Not Seeded)

Since `FLASK_ENV=production` prevents automatic seeding, create your admin user manually:

```bash
su - deploy
source /var/www/insuretrack/backend/venv/bin/activate
cd /var/www/insuretrack/backend

python3 -c "
from app import create_app
from models import db, User, Location
from werkzeug.security import generate_password_hash

app = create_app()
with app.app_context():
    # Create a default location
    if Location.query.count() == 0:
        loc = Location(name='Main Office')
        db.session.add(loc)
        db.session.commit()
        print(f'Created location: {loc.name} (id={loc.id})')

    # Create admin user
    if User.query.filter_by(email='admin@insurance.com').count() == 0:
        admin = User(
            email='admin@insurance.com',
            password=generate_password_hash('ChangeMe@2026'),
            role='central_admin',
            name='Admin',
            location='',
            location_id=None
        )
        db.session.add(admin)
        db.session.commit()
        print('Admin user created: admin@insurance.com / ChangeMe@2026')
    else:
        print('Admin user already exists')
"

exit
```

> **IMPORTANT:** Change the password `ChangeMe@2026` to your own strong password.

Now test login:

```bash
curl -s -X POST https://yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insurance.com","password":"ChangeMe@2026"}'
```

Expected: JSON response with `access_token`, `refresh_token`, and `user` object.

---

## 14. PHASE 13 — Maintenance & Operations

### How to Deploy Future Code Changes

**On your LOCAL computer:**

```bash
# 1. Build frontend
cd frontend
npm run build
cd ..

# 2. Push to Git (if using Git)
git add .
git commit -m "Description of changes"
git push origin main
```

**On the UTHO SERVER:**

```bash
# Option A: Pull from Git
cd /var/www/insuretrack/backend
su - deploy -c "cd /var/www/insuretrack/backend && git pull"

# Option B: SCP new files from local computer
# From your local computer:
# scp -r backend/routes/ deploy@<SERVER_IP>:/var/www/insuretrack/backend/routes/
# scp -r frontend/dist/ deploy@<SERVER_IP>:/var/www/insuretrack/frontend/dist/

# 3. Restart backend if backend code changed
systemctl restart insuretrack

# 4. Reload Nginx if frontend changed
systemctl reload nginx
```

### How to Restart the Application

```bash
# Full restart (backend + frontend)
systemctl restart insuretrack
systemctl reload nginx

# Just backend
systemctl restart insuretrack

# Just Nginx
systemctl reload nginx
```

### How to Update Dependencies

**Backend (Python):**

```bash
su - deploy
source /var/www/insuretrack/backend/venv/bin/activate
pip install --upgrade -r /var/www/insuretrack/backend/requirements.txt
deactivate
exit
systemctl restart insuretrack
```

**Frontend (Node — build locally, transfer dist):**

```bash
# On LOCAL computer:
cd frontend
npm update
npm run build
# Then transfer dist/ to server
```

### How to Run Database Migrations

Production uses **Alembic** migrations (checked into `backend/migrations/`). The app runs `alembic upgrade head` automatically on startup (`run_migrations()` in `app.py`), so normally you just restart:

```bash
systemctl restart insuretrack
```

To run migrations manually (e.g. after a code pull before restart):

```bash
su - deploy
source /var/www/insuretrack/backend/venv/bin/activate
cd /var/www/insuretrack/backend
alembic upgrade head
deactivate
exit
```

To create a new migration after changing `models.py`:

```bash
# Do this on your LOCAL machine against a dev copy, then commit
cd backend
alembic revision --autogenerate -m "describe change"
alembic upgrade head
# Commit both the model change and the generated migration file
```

### How to Run Tests (Before Every Deploy)

```bash
# Backend — on your LOCAL machine
cd backend
python -m pytest          # full suite (auth + policies + fixtures)
```

```bash
# Frontend — on your LOCAL machine
cd frontend
npm run build             # type-check + production build
npm run lint              # eslint (errors fail, warnings tolerated)
```

The repository ships a GitHub Actions workflow (`.github/workflows/ci.yml`) that runs backend pytest + frontend build/lint on every push/PR to `main`. A green CI run is the gate before deploying.

### How to Check Logs

```bash
# Application log (main app events)
tail -f /var/www/insuretrack/backend/logs/insuretrack.log

# Gunicorn access log
tail -f /var/www/insuretrack/backend/logs/gunicorn_access.log

# Gunicorn error log
tail -f /var/www/insuretrack/backend/logs/gunicorn_error.log

# systemd journal (process-level logs)
journalctl -u insuretrack -f

# Nginx access log
tail -f /var/log/nginx/insuretrack_access.log

# Nginx error log
tail -f /var/log/nginx/insuretrack_error.log
```

### How to Back Up the Database

**Manual backup:**

```bash
# On the Utho server
su - deploy
pg_dump -U insuretrack_user1 -h 127.0.0.1 insuretrack > /var/www/insuretrack/backup_$(date +%Y%m%d_%H%M%S).sql
exit
```

**Automated daily backup (add via cron):**

```bash
# As root, edit crontab
crontab -e

# Add this line (backs up daily at 2 AM):
0 2 * * * /usr/bin/su - deploy -c "pg_dump -U insuretrack_user1 -h 127.0.0.1 insuretrack > /var/www/insuretrack/backups/backup_\$(date +\%Y\%m\%d).sql"
```

Create the backups directory:

```bash
mkdir -p /var/www/insuretrack/backups
chown deploy:www-data /var/www/insuretrack/backups
```

**Restore from backup:**

```bash
# Drop and recreate database
sudo -u postgres dropdb insuretrack
sudo -u postgres createdb insuretrack -O insuretrack_user1

# Restore
psql -U insuretrack_user1 -d insuretrack -h 127.0.0.1 < /var/www/insuretrack/backups/backup_20260820.sql
```

### How to Roll Back a Deployment

```bash
# 1. Find the previous Git commit
cd /var/www/insuretrack/backend
git log --oneline -10

# 2. Checkout the previous commit
git checkout <commit-hash>

# 3. Restart
systemctl restart insuretrack

# 4. If frontend also needs rollback, rebuild locally and transfer
```

---

## 15. Appendix A — Full Server File Layout

```
/var/www/insuretrack/
├── backend/
│   ├── app.py                      # Flask application (create_app factory)
│   ├── models.py                   # SQLAlchemy ORM models
│   ├── gunicorn.conf.py            # Gunicorn production config
│   ├── requirements.txt            # Python dependencies
│   ├── alembic.ini                 # Alembic config
│   ├── migrations/                 # Alembic migrations (schema, applied on startup)
│   ├── tests/                      # Pytest suite (auth, policies)
│   ├── .env                        # PRODUCTION secrets (permissions: 640)
│   ├── logs/
│   │   ├── insuretrack.log         # Application log (rotating, 10MB × 10)
│   │   ├── gunicorn_access.log     # Gunicorn access log
│   │   └── gunicorn_error.log      # Gunicorn error log
│   ├── utils/
│   │   ├── __init__.py
│   │   └── auth.py                 # Auth helpers, validators, RBAC
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py                 # /api/auth/*
│   │   ├── policies.py            # /api/policies/*
│   │   ├── analytics.py           # /api/analytics/*
│   │   ├── companies.py           # /api/companies/*
│   │   ├── users.py               # /api/users/*
│   │   ├── locations.py           # /api/locations/*
│   │   ├── products.py            # /api/products/*
│   │   ├── field_members.py       # /api/field-members/*
│   │   ├── alerts.py              # /api/alerts/*
│   │   └── general_riders.py      # /api/general-riders/*
│   └── venv/                       # Python virtual environment
│       ├── bin/
│       ├── lib/
│       └── ...
├── frontend/
│   └── dist/                       # Built production files (served by Nginx)
│       ├── index.html
│       ├── favicon.svg
│       ├── icons.svg
│       └── assets/
│           ├── index-*.js          # Bundled JavaScript
│           └── index-*.css         # Bundled CSS
├── backups/                         # Database backups
│   └── backup_YYYYMMDD_HHMMSS.sql
```

---

## 16. Appendix B — Environment Variable Reference

| Variable | Value | Notes |
|----------|-------|-------|
| `SECRET_KEY` | 64-char hex string | Flask session/JWT signing key. Generate with: `python3.12 -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_SECRET_KEY` | 64-char hex string | JWT token signing key. Generate separately. |
| `DATABASE_URL` | `postgresql://insuretrack_user1:PASSWORD@127.0.0.1:5432/insuretrack` | Local PostgreSQL. No `?sslmode=require` needed for localhost. |
| `DB_POOL_SIZE` | `10` | Connection pool size |
| `DB_POOL_RECYCLE` | `300` | Recycle connections every 5 minutes |
| `DB_MAX_OVERFLOW` | `20` | Max additional connections beyond pool_size |
| `JWT_ACCESS_MINUTES` | `30` | Access token lifetime |
| `JWT_REFRESH_DAYS` | `30` | Refresh token lifetime |
| `CORS_ORIGINS` | `https://yourdomain.com,http://yourdomain.com` | Comma-separated allowed origins |
| `FORCE_HTTPS` | `true` | Force HTTPS in production |
| `SESSION_COOKIE_SECURE` | `true` | Only send cookies over HTTPS |
| `MAX_CONTENT_LENGTH_MB` | `5` | Max request body size |
| `LOG_LEVEL` | `INFO` | Logging level |
| `FLASK_DEBUG` | `false` | Disable debug mode |
| `FLASK_ENV` | `production` | Production mode (disables seed data) |

---

## 17. Appendix C — Troubleshooting

### Backend Won't Start

```bash
# Check logs for specific error
journalctl -u insuretrack -n 50

# Common causes:
# - Wrong SECRET_KEY/JWT_SECRET_KEY (must be >= 32 chars)
# - PostgreSQL not running: systemctl status postgresql
# - Wrong database credentials in .env
# - Port 5000 already in use: lsof -i :5000
```

### Nginx 502 Bad Gateway

```bash
# Gunicorn is not running
systemctl status insuretrack

# Check if port 5000 is listening
ss -tlnp | grep 5000

# Restart backend
systemctl restart insuretrack
```

### Nginx 403 Forbidden

```bash
# Check file permissions
ls -la /var/www/insuretrack/frontend/dist/
chown -R deploy:www-data /var/www/insuretrack/frontend/dist
chmod -R 755 /var/www/insuretrack/frontend/dist
```

### Database Connection Refused

```bash
# Check PostgreSQL is running
systemctl status postgresql

# Check if it's listening
ss -tlnp | grep 5432

# Check pg_hba.conf allows your user
cat /etc/postgresql/16/main/pg_hba.conf | grep insuretrack

# Test connection manually
psql -U insuretrack_user1 -d insuretrack -h 127.0.0.1
```

### SSL Certificate Issues

```bash
# Check certificate expiry
certbot certificates

# Force renewal
certbot renew --force-renewal

# Check Nginx config after renewal
nginx -t
systemctl reload nginx
```

### 500 Internal Server Error

```bash
# Check application logs
tail -50 /var/www/insuretrack/backend/logs/insuretrack.log

# Check Gunicorn error log
tail -50 /var/www/insuretrack/backend/logs/gunicorn_error.log
```

### Permission Denied Errors

```bash
# Ensure correct ownership
chown -R deploy:www-data /var/www/insuretrack

# Ensure .env is readable by www-data (Gunicorn runs as www-data)
chmod 640 /var/www/insuretrack/backend/.env
chown deploy:www-data /var/www/insuretrack/backend/.env
```

---

## 18. Appendix D — Production Architecture Diagram

```
                              ┌─────────────────────────────────────────┐
                              │              INTERNET                    │
                              │     User Browser (HTTPS)                │
                              └─────────────────┬───────────────────────┘
                                                │
                                                │ Port 443 (HTTPS)
                                                │ Port 80 → 301 redirect
                                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UTHO CLOUD SERVER                                    │
│                        Ubuntu 24.04 LTS                                     │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                          UFW FIREWALL                                │   │
│  │                    Open: SSH(22), HTTP(80), HTTPS(443)               │   │
│  └───────────────────────────────┬──────────────────────────────────────┘   │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         NGINX                                        │   │
│  │                    /etc/nginx/sites-available/insuretrack             │   │
│  │                                                                      │   │
│  │   ┌─────────────────────┐    ┌──────────────────────────────────┐    │   │
│  │   │   SSL Termination   │    │         Reverse Proxy            │    │   │
│  │   │   Let's Encrypt     │    │                                  │    │   │
│  │   │   TLS 1.2 / 1.3     │    │   /api/*  →  127.0.0.1:5000     │    │   │
│  │   └─────────────────────┘    └──────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │   ┌──────────────────────────────────────────────────────────────┐   │   │
│  │   │   Static File Serving + SPA Routing                          │   │   │
│  │   │   /var/www/insuretrack/frontend/dist/                         │   │   │
│  │   │   try_files → index.html (client-side routing)                │   │   │
│  │   └──────────────────────────────────────────────────────────────┘   │   │
│  └───────────┬─────────────────────────────────────┬────────────────────┘   │
│              │                                     │                        │
│              │ /api/*                              │ / (static)             │
│              ▼                                     ▼                        │
│  ┌───────────────────────┐          ┌──────────────────────────┐           │
│  │     GUNICORN          │          │      FRONTEND            │           │
│  │   127.0.0.1:5000      │          │   React + TypeScript     │           │
│  │                       │          │   Vite Production Build   │           │
│  │   Worker 1 ─┐         │          │   Tailwind CSS           │           │
│  │   Worker 2  │         │          │   Static HTML/JS/CSS     │           │
│  │   Worker 3  ├─ 5      │          └──────────────────────────┘           │
│  │   Worker 4  │  workers │                                               │
│  │   Worker 5 ─┘         │                                               │
│  │                       │                                               │
│  │   Flask 3.0.3         │                                               │
│  │   Flask-JWT-Extended   │                                               │
│  │   Flask-SQLAlchemy     │                                               │
│  │   Flask-CORS           │                                               │
│  │   Flask-Limiter        │                                               │
│  │   Flask-Talisman       │                                               │
│  └───────────┬───────────┘                                               │
│              │                                                            │
│              │ localhost (no SSL needed)                                   │
│              ▼                                                            │
│  ┌──────────────────────────────────────────┐                             │
│  │          PostgreSQL 16                    │                             │
│  │      127.0.0.1:5432                       │                             │
│  │      Database: insuretrack                │                             │
│  │      User: insuretrack_user1               │                             │
│  │                                          │                             │
│  │  Tables:                                 │                             │
│  │  ├── users                               │                             │
│  │  ├── policies                            │                             │
│  │  ├── companies                           │                             │
│  │  ├── locations                           │                             │
│  │  ├── products                            │                             │
│  │  ├── field_members                       │                             │
│  │  ├── vehicles                            │                             │
│  │  ├── policy_covers                       │                             │
│  │  ├── policy_riders                       │                             │
│  │  ├── general_riders                      │                             │
│  │  ├── policy_history                      │                             │
│  │  └── revoked_tokens                      │                             │
│  └──────────────────────────────────────────┘                             │
│                                                                           │
│  systemd: insuretrack.service (manages Gunicorn)                          │
│  Certbot: auto-renewal timer (certificates every 90 days)                │
│  Logs: /var/www/insuretrack/backend/logs/                                 │
│        /var/log/nginx/insuretrack_*.log                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

> **Deployment complete!** Your InsureTrack application is now live on Utho Cloud with HTTPS, local PostgreSQL, and full production security.
>
> **Default login:** `admin@insurance.com` / `ChangeMe@2026` (change this password immediately).
