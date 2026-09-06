#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Configuration
DOMAINS=("fuldabazar.cloudsredevops.com" "api.cloudsredevops.com")
EMAIL="faizananwar532@gmail.com"
NGINX_CONF_DIR="/etc/nginx/sites-available"
NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
CERTBOT_CONF_DIR="/etc/letsencrypt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Setting up HTTPS with Nginx and Certbot manually...${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run this script with sudo${NC}"
    exit 1
fi

# Update system packages
echo -e "${YELLOW}Updating system packages...${NC}"
apt update

# Install Nginx if not already installed
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Installing Nginx...${NC}"
    apt install -y nginx
else
    echo -e "${GREEN}Nginx is already installed${NC}"
fi

# Install Certbot if not already installed
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Installing Certbot...${NC}"
    apt install -y certbot python3-certbot-nginx
else
    echo -e "${GREEN}Certbot is already installed${NC}"
fi

# Create webroot directory
mkdir -p /var/www/html

# Step 1: Create initial Nginx configuration (HTTP only, for certificate challenge)
echo -e "${YELLOW}Creating initial Nginx configuration for frontend...${NC}"
cat > /etc/nginx/sites-available/fuldabazar.cloudsredevops.com << 'EOF'
server {
    listen 80;
    server_name fuldabazar.cloudsredevops.com;
    
    # Serve ACME challenge files
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS (will work after certificates are obtained)
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

echo -e "${YELLOW}Creating initial Nginx configuration for backend...${NC}"
cat > /etc/nginx/sites-available/api.cloudsredevops.com << 'EOF'
server {
    listen 80;
    server_name api.cloudsredevops.com;
    
    # Serve ACME challenge files
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    # Redirect all other traffic to HTTPS (will work after certificates are obtained)
    location / {
        return 301 https://$host$request_uri;
    }
}
EOF

# Enable sites
echo -e "${YELLOW}Enabling Nginx sites...${NC}"
ln -sf /etc/nginx/sites-available/fuldabazar.cloudsredevops.com /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/api.cloudsredevops.com /etc/nginx/sites-enabled/

# Remove default site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test and start Nginx
echo -e "${YELLOW}Testing Nginx configuration...${NC}"
nginx -t

echo -e "${YELLOW}Starting Nginx...${NC}"
systemctl enable nginx
systemctl start nginx

# Step 2: Obtain SSL certificates
for domain in "${DOMAINS[@]}"; do
    echo -e "${YELLOW}Requesting SSL certificate for $domain...${NC}"
    certbot certonly --webroot --webroot-path=/var/www/html --email $EMAIL --agree-tos --no-eff-email -d $domain
    echo -e "${GREEN}Certificate successfully obtained for $domain${NC}"
done

# Step 3: Update Nginx configuration with SSL
echo -e "${YELLOW}Updating Nginx configuration with SSL...${NC}"

# Update frontend configuration
cat > /etc/nginx/sites-available/fuldabazar.cloudsredevops.com << 'EOF'
server {
    listen 80;
    server_name fuldabazar.cloudsredevops.com;
    location / {
        return 301 https://$host$request_uri;
    }
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}

server {
    listen 443 ssl;
    server_name fuldabazar.cloudsredevops.com;
    
    ssl_certificate /etc/letsencrypt/live/fuldabazar.cloudsredevops.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fuldabazar.cloudsredevops.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Proxy to frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|otf)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
    }
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml application/xml+rss;
    gzip_disable "MSIE [1-6]\.";
}
EOF

# Update backend configuration
cat > /etc/nginx/sites-available/api.cloudsredevops.com << 'EOF'
server {
    listen 80;
    server_name api.cloudsredevops.com;
    location / {
        return 301 https://$host$request_uri;
    }
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}

server {
    listen 443 ssl;
    server_name api.cloudsredevops.com;
    
    ssl_certificate /etc/letsencrypt/live/api.cloudsredevops.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.cloudsredevops.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # CORS headers for API
    add_header 'Access-Control-Allow-Origin' 'https://fuldabazar.cloudsredevops.com' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
    add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
    add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range' always;
    
    # Client settings
    client_max_body_size 50m;
    client_body_buffer_size 128k;
    client_body_timeout 60s;
    client_header_timeout 60s;
    large_client_header_buffers 4 64k;
    
    # Handle preflight requests
    location / {
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' 'https://fuldabazar.cloudsredevops.com' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE, PATCH' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
        
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
EOF

# Test and reload Nginx
echo -e "${YELLOW}Testing updated Nginx configuration...${NC}"
nginx -t

echo -e "${YELLOW}Reloading Nginx with new certificates...${NC}"
systemctl reload nginx

# Set up automatic certificate renewal
echo -e "${YELLOW}Setting up automatic certificate renewal...${NC}"
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

echo -e "${GREEN}HTTPS setup completed successfully!${NC}"
echo -e "${GREEN}Your sites are now available at:${NC}"
echo -e "${GREEN}- https://fuldabazar.cloudsredevops.com${NC}"
echo -e "${GREEN}- https://api.cloudsredevops.com${NC}"
echo -e "${YELLOW}Note: Make sure your applications are running on the specified ports (3000 for frontend, 8000 for backend)${NC}"