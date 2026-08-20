import multiprocessing
import os

# Server socket
bind = os.environ.get('GUNICORN_BIND', '0.0.0.0:5000')
backlog = 2048

# Worker processes
workers = int(os.environ.get('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = 'sync'
worker_connections = 1000
timeout = 120
keepalive = 5

# Restart workers after this many requests (prevents memory leaks)
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = os.path.join(os.path.dirname(__file__), 'logs', 'gunicorn_access.log')
errorlog = os.path.join(os.path.dirname(__file__), 'logs', 'gunicorn_error.log')
loglevel = os.environ.get('LOG_LEVEL', 'info')

# Process naming
proc_name = 'insuretrack'

# Preload app for better performance and shared memory
preload_app = True

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Server mechanics
daemon = False
pidfile = None
tmp_upload_dir = None

# SSL (uncomment if not using nginx for SSL termination)
# certfile = '/etc/letsencrypt/live/yourdomain.com/fullchain.pem'
# keyfile = '/etc/letsencrypt/live/yourdomain.com/privkey.pem'
