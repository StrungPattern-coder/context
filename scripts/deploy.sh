#!/bin/bash
# RAL Deployment Script
# Quick deploy for various platforms

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║        RAL - Reality Augmentation Layer               ║"
    echo "║              Deployment Script v0.1.0                 ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check dependencies
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    print_success "All dependencies found"
}

# Generate SSL certificates (self-signed for development)
generate_ssl() {
    SSL_DIR="$DOCKER_DIR/nginx/ssl"
    
    if [ -f "$SSL_DIR/cert.pem" ] && [ -f "$SSL_DIR/key.pem" ]; then
        print_info "SSL certificates already exist"
        return
    fi
    
    print_info "Generating self-signed SSL certificates..."
    mkdir -p "$SSL_DIR"
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/key.pem" \
        -out "$SSL_DIR/cert.pem" \
        -subj "/C=US/ST=State/L=City/O=RAL/OU=Dev/CN=localhost" \
        2>/dev/null
    
    print_success "SSL certificates generated"
}

# Generate environment file
generate_env() {
    ENV_FILE="$DOCKER_DIR/.env"
    
    if [ -f "$ENV_FILE" ]; then
        print_info "Environment file already exists"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi
    
    print_info "Generating environment file..."
    
    # Generate random secrets
    SECRET_KEY=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -hex 16)
    
    cat > "$ENV_FILE" << EOF
# RAL Environment Configuration
# Generated on $(date)

# Database
DB_PASSWORD=$DB_PASSWORD

# API
SECRET_KEY=$SECRET_KEY
LOG_LEVEL=INFO
CORS_ORIGINS=*

# Ports
HTTP_PORT=80
HTTPS_PORT=443

# Optional: AI Provider Keys
# OPENAI_API_KEY=
# ANTHROPIC_API_KEY=
# GOOGLE_API_KEY=
EOF
    
    print_success "Environment file generated: $ENV_FILE"
    print_warning "Edit $ENV_FILE to add your AI provider API keys (optional)"
}

# Deploy with Docker Compose
deploy_docker() {
    print_info "Deploying with Docker Compose..."
    
    cd "$DOCKER_DIR"
    
    # Pull latest images
    docker compose pull 2>/dev/null || true
    
    # Build and start
    docker compose up -d --build
    
    print_success "RAL deployed successfully!"
    echo ""
    print_info "Services:"
    echo "  • API:      http://localhost:8000"
    echo "  • API Docs: http://localhost:8000/docs"
    echo "  • Health:   http://localhost:8000/health"
    echo ""
    print_info "To view logs: docker compose logs -f"
    print_info "To stop:      docker compose down"
}

# Deploy development mode
deploy_dev() {
    print_info "Starting development deployment..."
    
    cd "$DOCKER_DIR"
    
    # Only start dependencies
    docker compose up -d db redis
    
    print_success "Database and Redis started"
    echo ""
    print_info "Run the API locally with:"
    echo "  cd services/ral-core"
    echo "  poetry install"
    echo "  poetry run uvicorn app.main:app --reload"
}

# Run migrations
run_migrations() {
    print_info "Running database migrations..."
    
    cd "$DOCKER_DIR"
    docker compose run --rm migrations
    
    print_success "Migrations complete"
}

# Health check
health_check() {
    print_info "Checking RAL health..."
    
    for i in {1..30}; do
        if curl -s http://localhost:8000/health | grep -q "healthy"; then
            print_success "RAL is healthy!"
            return 0
        fi
        sleep 1
    done
    
    print_error "Health check failed"
    return 1
}

# Stop deployment
stop() {
    print_info "Stopping RAL..."
    cd "$DOCKER_DIR"
    docker compose down
    print_success "RAL stopped"
}

# Clean up
cleanup() {
    print_warning "This will remove all RAL containers, volumes, and data!"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd "$DOCKER_DIR"
        docker compose down -v --remove-orphans
        print_success "Cleanup complete"
    fi
}

# Show logs
logs() {
    cd "$DOCKER_DIR"
    docker compose logs -f "$@"
}

# Show status
status() {
    cd "$DOCKER_DIR"
    docker compose ps
}

# Main
main() {
    print_header
    
    case "${1:-}" in
        deploy|start|up)
            check_dependencies
            generate_env
            generate_ssl
            deploy_docker
            health_check
            ;;
        dev)
            check_dependencies
            generate_env
            deploy_dev
            ;;
        migrations)
            run_migrations
            ;;
        stop|down)
            stop
            ;;
        restart)
            stop
            deploy_docker
            ;;
        health)
            health_check
            ;;
        logs)
            shift
            logs "$@"
            ;;
        status)
            status
            ;;
        cleanup|clean)
            cleanup
            ;;
        *)
            echo "Usage: $0 {deploy|dev|stop|restart|migrations|health|logs|status|cleanup}"
            echo ""
            echo "Commands:"
            echo "  deploy     Deploy RAL with Docker Compose (production)"
            echo "  dev        Start only dependencies for local development"
            echo "  stop       Stop all RAL services"
            echo "  restart    Restart all RAL services"
            echo "  migrations Run database migrations"
            echo "  health     Check RAL health"
            echo "  logs       View service logs (add service name for specific)"
            echo "  status     Show service status"
            echo "  cleanup    Remove all containers, volumes, and data"
            exit 1
            ;;
    esac
}

main "$@"
