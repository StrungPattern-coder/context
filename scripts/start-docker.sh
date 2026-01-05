#!/bin/bash
# RAL Docker Compose Startup Script
# Starts all services using Docker Compose

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting RAL with Docker Compose...${NC}"

# Build and start all services
docker compose up --build -d

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}RAL is starting up!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Services will be available at:"
echo "  - Backend API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - Frontend: http://localhost:3000"
echo ""
echo "Watching logs... (Ctrl+C to stop watching, services continue running)"
echo ""

docker compose logs -f
