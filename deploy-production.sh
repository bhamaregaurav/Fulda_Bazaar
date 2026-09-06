#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Fulda Bazar Production Deployment ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run this script with sudo${NC}"
    exit 1
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if Docker is installed
if ! command_exists docker; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Function to check if ports are available
check_port() {
    if netstat -tuln | grep -q ":$1 "; then
        echo -e "${RED}Port $1 is already in use. Please free up port $1 and try again.${NC}"
        exit 1
    fi
}

# Check if required ports are available
echo -e "${YELLOW}Checking if required ports are available...${NC}"
check_port 3000
check_port 8000
check_port 80
check_port 443

echo -e "${GREEN}All required ports are available${NC}"

# Step 1: Set up HTTPS with Nginx and Certbot
echo -e "${YELLOW}Step 1: Setting up HTTPS with Nginx and Certbot...${NC}"
./setup-https-manual.sh

# Step 2: Start the applications
echo -e "${YELLOW}Step 2: Starting applications with Docker Compose...${NC}"

# Use docker compose if available, otherwise docker-compose
if docker compose version >/dev/null 2>&1; then
    echo -e "${GREEN}Using 'docker compose' command${NC}"
    DOCKER_COMPOSE_CMD="docker compose"
else
    echo -e "${GREEN}Using 'docker-compose' command${NC}"
    DOCKER_COMPOSE_CMD="docker-compose"
fi

# Build and start the applications
echo -e "${YELLOW}Building and starting applications...${NC}"
$DOCKER_COMPOSE_CMD -f docker-compose-apps.yml up -d --build

# Wait a moment for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Check if services are running
echo -e "${YELLOW}Checking service status...${NC}"
$DOCKER_COMPOSE_CMD -f docker-compose-apps.yml ps

# Test the applications
echo -e "${YELLOW}Testing application endpoints...${NC}"

# Test frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Frontend is running on port 3000${NC}"
else
    echo -e "${RED}✗ Frontend is not responding on port 3000${NC}"
fi

# Test backend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000 | grep -q "200\|404"; then
    echo -e "${GREEN}✓ Backend is running on port 8000${NC}"
else
    echo -e "${RED}✗ Backend is not responding on port 8000${NC}"
fi

# Test HTTPS endpoints
echo -e "${YELLOW}Testing HTTPS endpoints...${NC}"

# Test frontend HTTPS
if curl -s -o /dev/null -w "%{http_code}" https://fuldabazar.cloudsredevops.com | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓ Frontend HTTPS is working${NC}"
else
    echo -e "${RED}✗ Frontend HTTPS is not working${NC}"
fi

# Test backend HTTPS
if curl -s -o /dev/null -w "%{http_code}" https://api.cloudsredevops.com | grep -q "200\|404"; then
    echo -e "${GREEN}✓ Backend HTTPS is working${NC}"
else
    echo -e "${RED}✗ Backend HTTPS is not working${NC}"
fi

echo -e "${GREEN}=== Deployment completed successfully! ===${NC}"
echo -e "${GREEN}Your applications are now available at:${NC}"
echo -e "${GREEN}- Frontend: https://fuldabazar.cloudsredevops.com${NC}"
echo -e "${GREEN}- Backend API: https://api.cloudsredevops.com${NC}"
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "${YELLOW}- View logs: $DOCKER_COMPOSE_CMD -f docker-compose-apps.yml logs -f${NC}"
echo -e "${YELLOW}- Stop services: $DOCKER_COMPOSE_CMD -f docker-compose-apps.yml down${NC}"
echo -e "${YELLOW}- Restart services: $DOCKER_COMPOSE_CMD -f docker-compose-apps.yml restart${NC}"
echo -e "${YELLOW}- Nginx status: systemctl status nginx${NC}"
echo -e "${YELLOW}- Nginx logs: tail -f /var/log/nginx/error.log${NC}" 