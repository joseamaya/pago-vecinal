#!/bin/bash

# Build and deploy script for Railway

echo "🚀 Starting deployment process..."

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Please install it first:"
    echo "npm install -g @railway/cli"
    exit 1
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway login..."
railway login

# Deploy backend
echo "🚀 Deploying backend..."
cd backend
railway init --name "pago-vecinal-backend"
railway up
cd ..

# Deploy frontend
echo "🚀 Deploying frontend..."
cd frontend
railway init --name "pago-vecinal-frontend"
railway up
cd ..

echo "✅ Deployment completed!"
echo "🌐 Check your Railway dashboard for the deployed URLs"