#!/bin/bash

# Research Canvas Local Development Startup Script
# Starts both Python agent backend and frontend development server

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PYTHON_AGENT_DIR="agents/python"
AGENT_PORT=2024
FRONTEND_PORT=3000
ENV_FILE=".env.local"
VENV_DIR="$PYTHON_AGENT_DIR/.venv"

# Process IDs
AGENT_PID=""
FRONTEND_PID=""

# Log files
AGENT_LOG="agent.log"
FRONTEND_LOG="frontend.log"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"

    if [ ! -z "$AGENT_PID" ] && kill -0 $AGENT_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping Python agent (PID: $AGENT_PID)${NC}"
        kill $AGENT_PID 2>/dev/null || true
        wait $AGENT_PID 2>/dev/null || true
    fi

    if [ ! -z "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        echo -e "${BLUE}Stopping frontend (PID: $FRONTEND_PID)${NC}"
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi

    echo -e "${GREEN}Cleanup complete${NC}"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Helper function to print status
print_status() {
    echo -e "${BLUE}==>${NC} $1"
}

print_error() {
    echo -e "${RED}ERROR:${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}WARNING:${NC} $1"
}

# Check if we're in the right directory
if [ ! -d "$PYTHON_AGENT_DIR" ] || [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Must run from project root directory"
    print_error "Expected: $PYTHON_AGENT_DIR directory, package.json, and src directory"
    exit 1
fi

echo -e "${GREEN}Research Canvas - Local Development${NC}"
echo "======================================"
echo ""

# Step 1: Check/Create Python virtual environment
print_status "Checking Python virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    print_warning "Virtual environment not found. Creating..."
    cd "$PYTHON_AGENT_DIR"
    python3 -m venv .venv
    cd - > /dev/null
    print_success "Virtual environment created"
else
    print_success "Virtual environment exists"
fi

# Step 2: Install Python dependencies
print_status "Checking Python dependencies..."

# Check if uv is available
if command -v uv &> /dev/null; then
    print_status "Using uv for Python dependencies"
    cd "$PYTHON_AGENT_DIR"
    uv sync --quiet 2>/dev/null || uv sync
    cd - > /dev/null
    print_success "Python dependencies installed"
elif [ -f "$PYTHON_AGENT_DIR/.venv/bin/uvicorn" ]; then
    print_success "Python dependencies already installed"
else
    print_warning "Installing Python dependencies with pip..."
    cd "$PYTHON_AGENT_DIR"
    source .venv/bin/activate
    pip install -q -r requirements.txt
    deactivate
    cd - > /dev/null
    print_success "Python dependencies installed"
fi

# Step 3: Install frontend dependencies
print_status "Checking frontend dependencies..."
if [ ! -d "node_modules" ]; then
    print_warning "Installing frontend dependencies..."
    npm install --silent
    print_success "Frontend dependencies installed"
else
    print_success "Frontend dependencies installed"
fi

# Step 4: Validate environment variables
print_status "Validating environment configuration..."

if [ ! -f "$ENV_FILE" ]; then
    print_warning "$ENV_FILE not found"
    if [ -f ".env.example" ]; then
        print_warning "Creating $ENV_FILE from .env.example"
        cp .env.example $ENV_FILE
        print_error "Please edit $ENV_FILE with your API keys before continuing"
        exit 1
    else
        print_error "No .env.example or $ENV_FILE found"
        exit 1
    fi
fi

# Check for required variables
MISSING_VARS=()

# Source the env file and check
set +e  # Don't exit on error for this section
source $ENV_FILE

if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your-openai-key" ]; then
    MISSING_VARS+=("OPENAI_API_KEY")
fi

if [ -z "$TAVILY_API_KEY" ] || [ "$TAVILY_API_KEY" = "your-tavily-key" ]; then
    MISSING_VARS+=("TAVILY_API_KEY")
fi

set -e

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Missing or invalid environment variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    print_error "Please update $ENV_FILE with valid API keys"
    exit 1
fi

print_success "Environment variables validated"

# Optional variables info
if [ -z "$TAKO_API_TOKEN" ]; then
    print_warning "TAKO_API_TOKEN not set (optional - only needed for MCP data source)"
fi
echo $TAKO_API_TOKEN

echo ""
print_status "Starting services..."
echo ""

# Step 5: Start Python agent
print_status "Starting Python agent on port $AGENT_PORT..."

cd "$PYTHON_AGENT_DIR"

# Start agent in background (prefer uv if available)
if command -v uv &> /dev/null; then
    PORT=$AGENT_PORT uv run main.py > ../../$AGENT_LOG 2>&1 &
    AGENT_PID=$!
else
    source .venv/bin/activate
    PORT=$AGENT_PORT python main.py > ../../$AGENT_LOG 2>&1 &
    AGENT_PID=$!
    deactivate
fi

cd - > /dev/null

# Wait a moment for startup
sleep 2

# Check if process is still running
if ! kill -0 $AGENT_PID 2>/dev/null; then
    print_error "Python agent failed to start"
    print_error "Check $AGENT_LOG for details"
    cat $AGENT_LOG
    exit 1
fi

print_success "Python agent started (PID: $AGENT_PID)"

# Step 6: Wait for health check
print_status "Waiting for agent health check..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:$AGENT_PORT/health > /dev/null 2>&1; then
        print_success "Agent is healthy"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        print_error "Agent health check failed after $MAX_RETRIES attempts"
        print_error "Check $AGENT_LOG for details"
        cleanup
        exit 1
    fi
    sleep 1
done

# Step 7: Start frontend
print_status "Starting frontend on port $FRONTEND_PORT..."

PORT=$FRONTEND_PORT npm run dev:ui > $FRONTEND_LOG 2>&1 &
FRONTEND_PID=$!

# Wait a moment for startup
sleep 3

# Check if process is still running
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    print_error "Frontend failed to start"
    print_error "Check $FRONTEND_LOG for details"
    cleanup
    exit 1
fi

print_success "Frontend started (PID: $FRONTEND_PID)"

# Step 8: Display status
echo ""
echo -e "${GREEN}======================================"
echo "✓ All services running!"
echo "======================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC}  http://localhost:$FRONTEND_PORT"
echo -e "${BLUE}Agent:${NC}     http://localhost:$AGENT_PORT"
echo -e "${BLUE}Health:${NC}    http://localhost:$AGENT_PORT/health"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo "  Agent:    $AGENT_LOG"
echo "  Frontend: $FRONTEND_LOG"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Step 9: Wait for user interrupt
wait $AGENT_PID $FRONTEND_PID
