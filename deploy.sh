#!/bin/bash

# HuLa-Server Automated Deployment Script
# Supports Ubuntu 20.04+
# Usage: bash deploy.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}      HuLa-Server Full Deployment Script      ${NC}"
echo -e "${GREEN}==============================================${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 1. Check & Install Dependencies
echo -e "\n${YELLOW}[1/5] Checking System Dependencies...${NC}"

install_pkg() {
    if ! command_exists $1; then
        echo -e "${YELLOW}Installing $1...${NC}"
        sudo apt-get update
        sudo apt-get install -y $2
    else
        echo -e "${GREEN}✓ $1 is installed${NC}"
    fi
}

install_pkg curl curl
install_pkg git git
install_pkg java openjdk-21-jdk
install_pkg mvn maven

# Install Docker if missing
if ! command_exists docker; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
    echo -e "${YELLOW}Docker installed. Please re-login or run 'newgrp docker' to use docker without sudo.${NC}"
    echo -e "${YELLOW}Trying to continue with sudo...${NC}"
else
    echo -e "${GREEN}✓ Docker is installed${NC}"
fi

# Install Docker Compose Plugin if missing (usually comes with docker-ce now)
if ! docker compose version >/dev/null 2>&1; then
    echo -e "${YELLOW}Installing Docker Compose Plugin...${NC}"
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
fi

# 2. Build Project
echo -e "\n${YELLOW}[2/5] Building Project (Maven)...${NC}"
# Check if target directories exist, if not, build.
if [ ! -d "luohuo-cloud/luohuo-gateway/luohuo-gateway-server/target" ]; then
    echo -e "${YELLOW}Compiling source code (this may take a while)...${NC}"
    mvn clean package -DskipTests -T 1C
else
    echo -e "${GREEN}✓ Project already built (target found). Skipping build. Run 'mvn clean package' manually to rebuild.${NC}"
fi

# 3. Deploy Infrastructure
echo -e "\n${YELLOW}[3/5] Deploying Infrastructure (MySQL, Redis, Nacos, RocketMQ)...${NC}"
cd docs/install/docker

# Initialize passwords if .env doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}Initializing passwords...${NC}"
    bash init-passwords.sh --ip $(hostname -I | awk '{print $1}')
fi

# Deploy Infrastructure
# We use 'prod' profile by default as requested for "direct deployment"
bash deploy.sh prod

# Return to root
cd ../../../

# 4. Deploy Services
echo -e "\n${YELLOW}[4/5] Deploying Application Services...${NC}"

# Check if infrastructure is healthy (simple check)
if ! docker ps | grep -q nacos; then
    echo -e "${RED}Error: Nacos container is not running. Infrastructure deployment failed.${NC}"
    exit 1
fi

echo -e "${YELLOW}Starting application services...${NC}"
docker compose -f luohuo-cloud/docker-compose.services.yml up -d --build

# 5. Final Check
echo -e "\n${YELLOW}[5/5] Checking Service Status...${NC}"
sleep 10
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep hula

echo -e "\n${GREEN}==============================================${NC}"
echo -e "${GREEN}   Deployment Completed Successfully!   ${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "Gateway: http://localhost:18760"
echo -e "Nacos:   http://localhost:8848/nacos"
echo -e "Monitor: http://localhost:18760/actuator/health"
