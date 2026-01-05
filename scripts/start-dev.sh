#!/bin/bash
# RAL Development Environment Startup Script
# Usage: ./start-dev.sh [service]
# Services: all, backend, frontend, db

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Start database services only
start_db() {
    log_info "Starting PostgreSQL and Redis..."
    docker compose up -d postgres redis
    
    log_info "Waiting for services to be healthy..."
    sleep 5
    
    # Wait for PostgreSQL
    until docker compose exec -T postgres pg_isready -U ral > /dev/null 2>&1; do
        log_info "Waiting for PostgreSQL..."
        sleep 2
    done
    
    # Wait for Redis
    until docker compose exec -T redis redis-cli ping > /dev/null 2>&1; do
        log_info "Waiting for Redis..."
        sleep 2
    done
    
    log_success "Database services are ready!"
    log_info "PostgreSQL: localhost:5432"
    log_info "Redis: localhost:6379"
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."
    cd services/ral-core
    
    if [ -d "../../.venv" ]; then
        source ../../.venv/bin/activate
    fi
    
    PYTHONPATH=. alembic upgrade head
    cd ../..
    log_success "Migrations completed"
}

# Start backend service
start_backend() {
    log_info "Starting RAL Core backend..."
    cd services/ral-core
    
    if [ -d "../../.venv" ]; then
        source ../../.venv/bin/activate
    fi
    
    PYTHONPATH=. uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
    BACKEND_PID=$!
    cd ../..
    
    log_success "Backend started on http://localhost:8000"
    log_info "API Docs: http://localhost:8000/docs"
}

# Start frontend service
start_frontend() {
    log_info "Starting RAL Dashboard..."
    cd dashboard
    
    npm run dev -- --host 0.0.0.0 &
    FRONTEND_PID=$!
    cd ..
    
    log_success "Frontend started on http://localhost:3000"
}

# Start all services
start_all() {
    check_prerequisites
    start_db
    
    # Give DB time to initialize fully
    sleep 3
    
    run_migrations
    start_backend
    start_frontend
    
    echo ""
    log_success "========================================"
    log_success "RAL Development Environment is Ready!"
    log_success "========================================"
    echo ""
    log_info "Services:"
    log_info "  - Backend API: http://localhost:8000"
    log_info "  - API Docs: http://localhost:8000/docs"
    log_info "  - Frontend: http://localhost:3000"
    log_info "  - PostgreSQL: localhost:5432"
    log_info "  - Redis: localhost:6379"
    echo ""
    log_info "Default credentials:"
    log_info "  - Email: dev@ral.local"
    log_info "  - Password: password123"
    echo ""
    log_info "Press Ctrl+C to stop all services"
    
    # Wait for interrupt
    wait
}

# Stop all services
stop_all() {
    log_info "Stopping all services..."
    docker compose down
    pkill -f "uvicorn app.main:app" || true
    pkill -f "vite" || true
    log_success "All services stopped"
}

# Main
case "${1:-all}" in
    all)
        start_all
        ;;
    db)
        check_prerequisites
        start_db
        ;;
    backend)
        start_backend
        ;;
    frontend)
        start_frontend
        ;;
    migrate)
        run_migrations
        ;;
    stop)
        stop_all
        ;;
    *)
        echo "Usage: $0 {all|db|backend|frontend|migrate|stop}"
        exit 1
        ;;
esac
