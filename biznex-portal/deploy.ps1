#!/usr/bin/env pwsh
Set-Location F:\biznex-portal

# Stage the files
Write-Host "Staging files..."
git add public/index.html public/app.js public/style.css

# Check if there are changes
$status = git status --short
Write-Host "Git Status:"
Write-Host $status

# Commit
Write-Host "`nCommitting changes..."
git commit -m "✨ Redesign: Login-first dashboard with sidebar and metrics"

# Push to GitHub
Write-Host "`nPushing to GitHub..."
git push origin main

Write-Host "`n✅ Complete!"
git log --oneline -3
