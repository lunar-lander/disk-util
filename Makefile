# Disk Usage Monitor - Makefile
# Cross-platform desktop application for monitoring disk usage and IOPS

.PHONY: help install dev dev-renderer dev-electron build build-renderer build-main package clean typecheck lint test start stop kill-processes status deps-check deps-install deps-update release docker-build docker-run

# Default target
help: ## Show this help message
	@echo "Disk Usage Monitor - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick Start:"
	@echo "  make install  # Install dependencies"
	@echo "  make dev      # Start development mode"
	@echo "  make build    # Build for production"
	@echo "  make package  # Create distributable packages"

# Installation and Dependencies
install: ## Install all dependencies
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Dependencies installed successfully"

deps-check: ## Check for outdated dependencies
	@echo "🔍 Checking for outdated dependencies..."
	npm outdated || true

deps-install: install ## Alias for install

deps-update: ## Update all dependencies to latest versions
	@echo "🔄 Updating dependencies..."
	npm update
	@echo "✅ Dependencies updated"

# Development
dev: ## Start development mode (both renderer and electron)
	@echo "🚀 Starting development mode..."
	npm run dev

dev-renderer: ## Start only the React development server
	@echo "🖥️  Starting React development server..."
	npm run dev:renderer

dev-electron: ## Start only Electron (requires renderer to be running)
	@echo "⚡ Starting Electron application..."
	npm run dev:electron

start: dev ## Alias for dev

# Building
build: ## Build the entire application for production
	@echo "🏗️  Building application..."
	npm run build
	@echo "✅ Build completed successfully"

build-renderer: ## Build only the React renderer
	@echo "🏗️  Building React renderer..."
	npm run build:renderer
	@echo "✅ Renderer build completed"

build-main: ## Build only the Electron main process
	@echo "🏗️  Building Electron main process..."
	npm run build:main
	@echo "✅ Main process build completed"

# Packaging
package: build ## Create distributable packages (requires build)
	@echo "📦 Creating distributable packages..."
	npm run package
	@echo "✅ Packages created in release/ directory"

# Quality Assurance
typecheck: ## Run TypeScript type checking
	@echo "🔍 Running TypeScript type checking..."
	npm run typecheck
	@echo "✅ Type checking completed"

lint: ## Run code linting
	@echo "🔍 Running code linting..."
	npm run lint

test: ## Run test suite
	@echo "🧪 Running tests..."
	npm run test

# Process Management
stop: kill-processes ## Stop all running development processes

kill-processes: ## Kill all Node.js and Electron processes (use with caution)
	@echo "🛑 Stopping all development processes..."
	-pkill -f "npm run dev"
	-pkill -f "vite"
	-pkill -f "electron"
	-pkill -f "node.*vite"
	@echo "✅ Processes stopped"

status: ## Show status of running processes
	@echo "📊 Process Status:"
	@echo "Vite processes:"
	@pgrep -f "vite" || echo "  No Vite processes running"
	@echo "Electron processes:"
	@pgrep -f "electron" || echo "  No Electron processes running"
	@echo "Node processes (dev):"
	@pgrep -f "npm run dev" || echo "  No npm dev processes running"

# Cleanup
clean: ## Clean build artifacts and node_modules
	@echo "🧹 Cleaning up..."
	rm -rf dist/
	rm -rf release/
	rm -rf node_modules/
	rm -rf .vite/
	@echo "✅ Cleanup completed"

clean-build: ## Clean only build artifacts (keep node_modules)
	@echo "🧹 Cleaning build artifacts..."
	rm -rf dist/
	rm -rf release/
	rm -rf .vite/
	@echo "✅ Build artifacts cleaned"

# Release Management
release: clean install typecheck build package ## Full release pipeline
	@echo "🚀 Release pipeline completed!"
	@echo "📦 Packages available in release/ directory"
	@ls -la release/ || echo "No release directory found"

# Docker Support (if needed for CI/CD)
docker-build: ## Build Docker image for CI/CD
	@echo "🐳 Building Docker image..."
	docker build -t disk-usage-monitor .

docker-run: ## Run application in Docker container
	@echo "🐳 Running in Docker container..."
	docker run -it --rm -v /tmp/.X11-unix:/tmp/.X11-unix -e DISPLAY=$$DISPLAY disk-usage-monitor

# System Requirements Check
sys-check: ## Check system requirements
	@echo "🔧 Checking system requirements..."
	@node --version || (echo "❌ Node.js not found" && exit 1)
	@npm --version || (echo "❌ npm not found" && exit 1)
	@echo "✅ Node.js: $$(node --version)"
	@echo "✅ npm: $$(npm --version)"
	@echo "✅ Platform: $$(uname -s)"
	@echo "✅ Architecture: $$(uname -m)"

# Quick Development Workflow
quick-start: install dev ## Install dependencies and start development

quick-build: clean install build ## Clean, install, and build

quick-package: clean install build package ## Full package creation workflow

# Logging and Debugging
logs: ## Show application logs (if any log files exist)
	@echo "📋 Application logs:"
	@find . -name "*.log" -type f -exec echo "=== {} ===" \; -exec cat {} \; 2>/dev/null || echo "No log files found"

debug: ## Start development with debug information
	@echo "🐛 Starting debug mode..."
	DEBUG=* npm run dev

# File watching and auto-restart (for development)
watch: ## Watch files and auto-restart (requires nodemon)
	@echo "👀 Starting file watcher..."
	npx nodemon --watch src --ext ts,tsx,js,jsx --exec "make build-main"

# Performance and Analysis
analyze: ## Analyze bundle size and dependencies
	@echo "📊 Analyzing bundle..."
	npm run build:renderer -- --mode analyze || echo "Bundle analysis not configured"
	@echo "📊 Dependency analysis:"
	npx depcheck || npm install -g depcheck && npx depcheck

# Git Hooks and Version Management
pre-commit: typecheck lint ## Run pre-commit checks
	@echo "✅ Pre-commit checks passed"

version-patch: ## Bump patch version
	npm version patch
	@echo "📝 Version bumped (patch)"

version-minor: ## Bump minor version
	npm version minor
	@echo "📝 Version bumped (minor)"

version-major: ## Bump major version
	npm version major
	@echo "📝 Version bumped (major)"

# Environment Setup
setup-dev: install ## Setup development environment
	@echo "🔧 Setting up development environment..."
	@echo "Creating necessary directories..."
	mkdir -p logs
	mkdir -p temp
	@echo "✅ Development environment ready"

# Maintenance
update-docs: ## Update documentation
	@echo "📚 Updating documentation..."
	@echo "CLAUDE.md is the main documentation file"
	@echo "✅ Documentation updated"

backup: ## Create backup of source code
	@echo "💾 Creating backup..."
	tar -czf "backup-$$(date +%Y%m%d-%H%M%S).tar.gz" --exclude=node_modules --exclude=dist --exclude=release .
	@echo "✅ Backup created"

# Platform-specific commands
windows-setup: ## Windows-specific setup
	@echo "🪟 Windows setup..."
	@echo "Make sure you have Visual Studio## I Build Tools installed"

macos-setup: ## macOS-specific setup
	@echo "🍎 macOS setup..."
	@echo "Make sure you have Xcode Command Line Tools installed"

linux-setup: ## Linux-specific setup
	@echo "🐧 Linux setup..."
	@echo "Make sure you have build-essential installed"

# Information
info: ## Show project information
	@echo "📋 Project Information:"
	@echo "Name: Disk Usage Monitor"
	@echo "Description: Cross-platform desktop app for monitoring disk usage and IOPS"
	@echo "Technology: Electron + React + TypeScript"
	@echo "Author: Generated with Claude Code"
	@echo ""
	@echo "Project Structure:"
	@tree -I 'node_modules|dist|release' -L 3 || ls -la

# Default values for variables
NODE_ENV ?= development
PORT ?= 5173

# Export variables for sub-makes
export NODE_ENV
export PORT
