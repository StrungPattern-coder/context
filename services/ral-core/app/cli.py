"""
RAL CLI - Command Line Interface

Provides commands to start, configure, and manage the RAL server.
"""

import argparse
import os
import sys
from pathlib import Path


def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="ral",
        description="Reality Anchoring Layer - Context Intelligence for AI",
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Start command
    start_parser = subparsers.add_parser("start", help="Start the RAL server")
    start_parser.add_argument(
        "--host",
        default="0.0.0.0",
        help="Host to bind to (default: 0.0.0.0)",
    )
    start_parser.add_argument(
        "--port",
        type=int,
        default=8765,
        help="Port to bind to (default: 8765)",
    )
    start_parser.add_argument(
        "--reload",
        action="store_true",
        help="Enable auto-reload for development",
    )
    start_parser.add_argument(
        "--workers",
        type=int,
        default=1,
        help="Number of worker processes (default: 1)",
    )
    
    # Config command
    config_parser = subparsers.add_parser("config", help="Show or set configuration")
    config_parser.add_argument(
        "--show",
        action="store_true",
        help="Show current configuration",
    )
    
    # Version command
    version_parser = subparsers.add_parser("version", help="Show version information")
    
    # Health command  
    health_parser = subparsers.add_parser("health", help="Check server health")
    health_parser.add_argument(
        "--url",
        default="http://localhost:8765",
        help="RAL server URL (default: http://localhost:8765)",
    )
    
    args = parser.parse_args()
    
    if args.command == "start":
        start_server(args)
    elif args.command == "config":
        show_config(args)
    elif args.command == "version":
        show_version()
    elif args.command == "health":
        check_health(args)
    else:
        parser.print_help()
        sys.exit(1)


def start_server(args):
    """Start the RAL server using uvicorn."""
    try:
        import uvicorn
    except ImportError:
        print("Error: uvicorn not installed. Run: pip install uvicorn[standard]")
        sys.exit(1)
    
    print(f"""
╔═══════════════════════════════════════════════════════════════╗
║          Reality Anchoring Layer (RAL) v0.1.0                 ║
║          Context Intelligence for AI Systems                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Server starting on http://{args.host}:{args.port}                       ║
║  API Documentation: http://{args.host}:{args.port}/docs                  ║
║  Health Check: http://{args.host}:{args.port}/health                     ║
╚═══════════════════════════════════════════════════════════════╝
    """)
    
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        workers=args.workers if not args.reload else 1,
    )


def show_config(args):
    """Show current configuration."""
    from app.core.config import settings
    
    print("\n=== RAL Configuration ===\n")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"Debug: {settings.DEBUG}")
    print(f"Database URL: {settings.DATABASE_URL[:50]}...")
    print(f"Redis URL: {settings.REDIS_URL}")
    print(f"CORS Origins: {settings.CORS_ORIGINS}")
    print()


def show_version():
    """Show version information."""
    print("""
Reality Anchoring Layer (RAL)
Version: 0.1.0
Python: 3.11+
License: Apache 2.0

Core Components:
  - Temporal Engine
  - Spatial Engine  
  - Situational Engine
  - Drift Detector
  - Prompt Composer
  - Context Memory

Documentation: https://ral.dev/docs
Repository: https://github.com/raldev/ral
    """)


def check_health(args):
    """Check server health."""
    try:
        import httpx
    except ImportError:
        print("Error: httpx not installed. Run: pip install httpx")
        sys.exit(1)
    
    try:
        response = httpx.get(f"{args.url}/health", timeout=5.0)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ RAL server is healthy")
            print(f"  Status: {data.get('status')}")
            print(f"  Version: {data.get('version')}")
        else:
            print(f"✗ RAL server returned status {response.status_code}")
            sys.exit(1)
    except httpx.ConnectError:
        print(f"✗ Cannot connect to RAL server at {args.url}")
        print(f"  Make sure the server is running: ral start")
        sys.exit(1)
    except Exception as e:
        print(f"✗ Error checking health: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
