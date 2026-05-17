#!/bin/bash

# Auto Git Upload Script
# This script adds all changes, commits them with an auto-generated timestamp, and pushes to the current branch.

echo "🚀 Starting auto-upload to Git..."

# Ensure we are in a git repository
if [ ! -d ".git" ]; then
  echo "❌ This is not a git repository. Please run 'git init' first."
  exit 1
fi

# Check if there are any changes
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ No changes to commit."
  exit 0
fi

# Add all changes
git add .

# Create commit with current timestamp
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
git commit -m "Auto update: $TIMESTAMP"

# Push to the remote (assuming the current branch is tracking a remote branch)
echo "⬆️ Pushing changes..."
git push

if [ $? -eq 0 ]; then
  echo "✅ Successfully uploaded to Git!"
else
  echo "❌ Failed to push. Make sure your remote is set up correctly."
fi
