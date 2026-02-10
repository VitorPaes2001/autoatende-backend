#!/bin/bash

# ==========================================
# AUTOATENDE AI - VPS DEPLOYMENT SCRIPT
# ==========================================

# Configuration
REPO_URL="https://github.com/{OWNER}/autoatende-ai.git"
APP_DIR="/opt/autoatende"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting AutoAtende AI Deployment...${NC}"

# 1. Prepare Directory
if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}📂 Directory $APP_DIR exists. Updating code...${NC}"
    cd $APP_DIR
    git pull origin main
else
    echo -e "${YELLOW}📂 Cloning repository...${NC}"
    cd /opt
    # Ensure git is installed
    if ! command -v git &> /dev/null; then
        echo -e "${RED}❌ Git is not installed. Installing...${NC}"
        apt-get update && apt-get install -y git
    fi
    git clone $REPO_URL autoatende
    cd $APP_DIR
fi

# 2. Setup Environment Check
if [ ! -f ".env" ]; then
    echo -e "${RED}⚠️  CRITICAL: .env file not found!${NC}"
    echo "Please create /opt/autoatende/.env with the following variables:"
    echo "NODE_ENV=production"
    echo "SUPABASE_URL=..."
    echo "SUPABASE_SERVICE_ROLE_KEY=..."
    echo "WHATSAPP_TOKEN=..."
    echo "WHATSAPP_PHONE_NUMBER_ID=..."
    echo "OPENAI_API_KEY=..."
    echo "STRIPE_SECRET_KEY=..."
    echo "STRIPE_WEBHOOK_SECRET=..."
    exit 1
fi

# 3. Docker Cleanup & Build
echo -e "${YELLOW}🐳 Stopping old containers...${NC}"
docker compose down || true

echo -e "${YELLOW}🏗️  Building Containers (No Cache)...${NC}"
docker compose build --no-cache

# 4. Start Services
echo -e "${GREEN}🚀 Starting Services...${NC}"
docker compose up -d

# 5. Validation
echo -e "${YELLOW}🔍 Validating Health...${NC}"
echo "Waiting 15s for services to stabilize..."
sleep 15

# Healthcheck
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/api/health)
if [ "$HTTP_STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Healthcheck Passed (200 OK)!${NC}"
else
    echo -e "${RED}❌ Healthcheck Failed (Status: $HTTP_STATUS)${NC}"
    echo "Logs (last 20 lines):"
    docker compose logs | tail -n 20
    exit 1
fi

# Billing Check
BILLING_STATUS=$(curl -s http://localhost:3000/api/billing/status)
echo "Billing Response: $BILLING_STATUS"

if [[ $BILLING_STATUS == *"Business"* ]]; then
     echo -e "${GREEN}✅ Billing Validated: Business Plan Active${NC}"
else
     echo -e "${RED}⚠️  Billing Warning: Expected Business Plan${NC}"
fi

echo -e "${GREEN}✅ Deployment Complete! System is LIVE.${NC}"
