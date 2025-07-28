#!/bin/bash

# Territory Wars - Quick Start Script
echo "🏰 Territory Wars - Starting Game Server..."
echo "=========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ and try again."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies if not already installed
if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run setup
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed successfully"
else
    echo "✅ Dependencies already installed"
fi

# Get the port
PORT=${PORT:-3000}

echo "🚀 Starting Territory Wars server on port $PORT..."
echo "🌐 Game will be available at: http://localhost:$PORT"
echo "⚡ Press Ctrl+C to stop the server"
echo "=========================================="

# Start the server
cd server && npm start