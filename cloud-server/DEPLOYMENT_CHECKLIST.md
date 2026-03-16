# ☁️ CLOUD SERVER - PRODUCTION DEPLOYMENT CHECKLIST

**Status:** ✅ READY FOR DEPLOYMENT  
**Date:** March 16, 2026

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### Infrastructure Setup (DevOps)
- [ ] Linux server provisioned (Ubuntu 20.04 LTS recommended)
- [ ] Node.js 18.x LTS installed
- [ ] PostgreSQL 13+ installed
- [ ] Nginx or Apache installed (reverse proxy)
- [ ] SSL/TLS certificate obtained
- [ ] Firewall configured
- [ ] SSH access configured
- [ ] Monitoring tools installed (optional: Prometheus, Grafana)

### PostgreSQL Setup
- [ ] PostgreSQL service running
- [ ] Database `biznex_license` created
- [ ] User `biznex_app` created with limited permissions
- [ ] Strong password set (20+ random chars)
- [ ] Remote access restricted to app servers only
- [ ] SSL connections enabled
- [ ] Daily automatic backups configured
- [ ] Backup retention policy set (30 days)
- [ ] Test restore procedure works

### Application Setup
- [ ] Clone cloud server repo: `git clone https://github.com/coder1317/biznex-cloud-server.git`
- [ ] Navigate: `cd /opt/biznex-cloud-server`
- [ ] Install dependencies: `npm install`
- [ ] Copy .env file: `cp .env.example .env`
- [ ] Edit .env with production values:
  - [ ] DATABASE_URL → PostgreSQL connection string
  - [ ] JWT_SECRET → new 64-char random string
  - [ ] JWT_REFRESH_SECRET → new 64-char random string
  - [ ] ADMIN_EMAIL → your admin email
  - [ ] ADMIN_PASSWORD → strong password
  - [ ] NODE_ENV=production
  - [ ] ALLOWED_ORIGINS → your domains
  - [ ] UPDATE_BASE_URL → your domain
- [ ] Create backup directory: `mkdir -p /var/biznex/backups`
- [ ] Set permissions: `chown -R app:app /var/biznex`
- [ ] Verify .env is NOT committed to git
- [ ] Add .env to .gitignore (if not already)

### Database Initialization
- [ ] Run migrations: `npm run migrate`
- [ ] Verify 6 tables created:
  ```sql
  \dt  # In psql
  ```
  Should show: accounts, license_keys, activations, sync_backups, releases, refresh_tokens
- [ ] Verify admin account created
- [ ] Test admin login: `curl -X POST http://localhost:4000/api/auth/login ...`
- [ ] Verify JWT tokens generated successfully

### Security Hardening
- [ ] Helmet security headers enabled (in code)
- [ ] CORS origin whitelist configured
- [ ] Rate limiting configured (200 general, 20 auth)
- [ ] Input validation with Joi active (in code)
- [ ] SQL injection prevention (parameterized queries)
- [ ] Password hashing (bcrypt, 12 rounds)
- [ ] File upload limits set (1MB)
- [ ] Request body limits set (1MB)
- [ ] Error messages don't expose stack traces
- [ ] Sensitive data not logged (passwords, tokens)
- [ ] SSL/TLS certificates valid
- [ ] Cipher suites hardened (TLS 1.2+ only)

### Monitoring & Logging
- [ ] PM2 installed globally: `npm install -g pm2`
- [ ] ecosystem.config.js reviewed and customized
- [ ] LogRocket or Sentry configured (optional)
- [ ] Log rotation configured (logrotate)
- [ ] Health endpoint tested: `curl http://localhost:4000/health`
- [ ] Monitoring dashboard setup (PM2 Plus optional)
- [ ] Alert thresholds configured
- [ ] Uptime monitoring service configured

### Performance & Capacity
- [ ] Database connection pool reviewed (max 20)
- [ ] Memory limits set (300M in PM2 config)
- [ ] CPU cores assigned appropriately
- [ ] Load testing completed
  - [ ] 100 concurrent users test passed
  - [ ] Response times acceptable (<500ms)
  - [ ] No memory leaks detected
  - [ ] Database connections stable
- [ ] Caching strategy configured (optional)
- [ ] CDN configured for /releases (optional)

### Backup & Disaster Recovery
- [ ] Backup directory created and tested
- [ ] Automated backup script created:
  ```bash
  pg_dump postgresql://... | gzip > /backups/$(date +%Y%m%d).sql.gz
  ```
- [ ] S3 backup upload configured (optional)
- [ ] Database backups scheduled (hourly/daily)
- [ ] Backup retention policy set (30 days)
- [ ] Restore procedure tested and documented
- [ ] RTO/RPO targets defined
- [ ] Disaster recovery runbook created

### Integration Testing
- [ ] Create test customer account
- [ ] Issue test license key
- [ ] Test license activation flow
- [ ] Test device activation (create 3 test devices)
- [ ] Test database sync (push/pull)
- [ ] Test update check endpoint
- [ ] Test admin panel endpoints
- [ ] Test rate limiting (send 201 requests)
- [ ] Test JWT refresh flow
- [ ] Verify CORS headers on requests from different origins
- [ ] Test all 5 route groups working
- [ ] Load test: 100 concurrent login attempts
- [ ] Stress test: 1000 simultaneous connections

### Deployment Procedure
- [ ] Team briefed on deployment steps
- [ ] Rollback plan documented
- [ ] Maintenance window scheduled
- [ ] Database backup taken
- [ ] Current version tagged in git
- [ ] All team members have deployment access
- [ ] Communication channel open during deployment

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Pre-Flight Check (15 minutes)
```bash
# SSH to production server
ssh deploy@your-server.com

# Verify Node.js
node --version  # Should be v18.x or higher

# Verify PostgreSQL
psql --version  # Should be 13+
psql $DATABASE_URL -c "SELECT version();"

# Verify npm packages
npm list | grep biznex-license-server

# Check disk space
df -h  # Should have 10GB+ free
```

### Step 2: Backup Current State (5 minutes)
```bash
# Backup current database
pg_dump $DATABASE_URL | gzip > /backups/pre-deploy-$(date +%Y%m%d-%H%M%S).sql.gz

# Backup current code (if already deployed)
cp -r /opt/biznex-cloud-server /opt/biznex-cloud-server.backup.$(date +%Y%m%d)
```

### Step 3: Update Application (10 minutes)
```bash
cd /opt/biznex-cloud-server

# Pull latest code
git fetch origin
git checkout main  # or your branch
git pull origin main

# Install/update dependencies
npm install --production

# Run migrations (if any DB changes)
npm run migrate
```

### Step 4: Verify Configuration (5 minutes)
```bash
# Check .env file exists
test -f .env && echo "✓ .env exists" || echo "✗ .env missing"

# Verify critical env vars set
grep -E "JWT_SECRET|DATABASE_URL|ADMIN_EMAIL" .env | wc -l
# Should output 3

# Verify not using default secrets
grep "CHANGE_ME" .env && echo "✗ Default secrets found!" || echo "✓ Custom secrets set"
```

### Step 5: Stop Current Service (2 minutes)
```bash
# Stop PM2 service
pm2 stop biznex-license-server
pm2 delete biznex-license-server

# Verify stopped
ps aux | grep "node src/index.js" | grep -v grep || echo "✓ Service stopped"
```

### Step 6: Start New Service (2 minutes)
```bash
# Start with ecosystem config
pm2 start ecosystem.config.js

# Verify running
pm2 status

# View logs
pm2 logs biznex-license-server --lines 20
```

### Step 7: Test Health (5 minutes)
```bash
# Health check
curl http://localhost:4000/health
# Should return: {"status":"ok",...}

# Test login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourdomain.com","password":"YourPassword"}'
# Should return JWT tokens

# Test database
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:4000/api/admin/stats
# Should return stats
```

### Step 8: Verify Reverse Proxy (5 minutes)
```bash
# Test via nginx/Apache
curl -H "Host: license.yourdomain.com" \
  https://your-server.com/health
# Should return 200

# Check SSL certificate valid
curl -I https://your-server.com/health | head -5
# Should show: HTTP/2 200
```

### Step 9: Rollback Plan (Keep Ready)
```bash
# If anything fails, rollback:
pm2 stop biznex-license-server
pm2 delete biznex-license-server
rm -rf /opt/biznex-cloud-server
cp -r /opt/biznex-cloud-server.backup.* /opt/biznex-cloud-server
pm2 start ecosystem.config.js

# Restore database (if needed)
gunzip < /backups/pre-deploy-*.sql.gz | psql $DATABASE_URL
```

### Step 10: Post-Deployment (15 minutes)
```bash
# Enable auto-restart on reboot
pm2 startup
pm2 save

# Monitor logs for 15 minutes
pm2 logs biznex-license-server

# Send all-clear notification to team
echo "✅ Cloud Server deployed successfully"
```

---

## ✅ POST-DEPLOYMENT VERIFICATION

### Functional Tests
- [ ] Health endpoint returns 200
- [ ] Admin login successful
- [ ] Can create customer account
- [ ] Can issue license key
- [ ] Can activate license
- [ ] Can validate license
- [ ] Rate limiting works (send 201 requests)
- [ ] CORS headers correct
- [ ] Backup sync endpoints working
- [ ] Update check endpoint working
- [ ] Database queries returning data

### Performance Tests
- [ ] Response time < 500ms
- [ ] No memory leaks (heap stable)
- [ ] Database connections < 10
- [ ] CPU usage < 50%
- [ ] Load test 100 concurrent users OK

### Security Tests
- [ ] HTTPS enforced
- [ ] JWT tokens valid
- [ ] Refresh tokens work
- [ ] Expired tokens rejected (401)
- [ ] Invalid tokens rejected (401)
- [ ] Unauthenticated requests blocked
- [ ] Admin endpoints require admin role
- [ ] Rate limiting active
- [ ] CORS origin validated
- [ ] SQL injection prevention working

### Integration Tests
- [ ] Biznex BOS app can reach cloud server
- [ ] App can activate license
- [ ] App can validate license
- [ ] App can sync database
- [ ] App can check for updates
- [ ] Portal can manage licenses

---

## 📊 DEPLOYMENT RECORD

Fill this out after successful deployment:

```
Deployment Date: _______________
Deployed By: _______________
Approved By: _______________

Version Deployed: _______________
Previous Version: _______________
Git Commit: _______________

Database: ✓ Migrated / ⚪ No changes
Downtime: _______________ minutes
Rollback Used: ⚪ Yes / ✓ No

All Tests: ✓ Passed / ⚪ Failed
Performance: ✓ Acceptable / ⚪ Issues

Issues Found: _______________
Actions Taken: _______________

Notification Sent: ✓ Yes / ⚪ No
Time: _______________
```

---

## 🔄 MAINTENANCE AFTER DEPLOYMENT

### Daily
- [ ] Check server uptime: `pm2 status`
- [ ] Review error logs: `pm2 logs` (last 20 lines)
- [ ] Monitor disk space: `df -h`
- [ ] Verify backups running

### Weekly
- [ ] Review security logs
- [ ] Check database size growth
- [ ] Review performance metrics
- [ ] Test backup restore procedure
- [ ] Review rate limiting stats

### Monthly
- [ ] npm audit for security updates
- [ ] PostgreSQL statistics analysis
- [ ] Capacity planning review
- [ ] License generation/expiration audit
- [ ] Compliance check

### Quarterly
- [ ] Full disaster recovery test
- [ ] Security penetration test (optional)
- [ ] Performance optimization review
- [ ] Architecture review
- [ ] Capacity upgrade planning (if needed)

---

## 📞 QUICK REFERENCE

### Critical Commands
```bash
# View status
pm2 status

# View logs
pm2 logs biznex-license-server

# Restart service
pm2 restart biznex-license-server

# Stop service
pm2 stop biznex-license-server

# Database backup
pg_dump $DATABASE_URL | gzip > backup.sql.gz

# Database restore
gunzip < backup.sql.gz | psql $DATABASE_URL

# Health check
curl http://localhost:4000/health

# Check running processes
ps aux | grep node
```

### Contact
- **Administrator:** _______________
- **On-Call:** _______________
- **Escalation:** _______________
- **Incident Channel:** _______________

---

## ✅ DEPLOYMENT SIGN-OFF

- [ ] All checklist items completed
- [ ] All tests passing
- [ ] Team briefed and ready
- [ ] Monitoring in place
- [ ] Rollback plan documented
- [ ] Database backups verified

**Deployment Status:** ✅ **READY TO PROCEED**

---

**Cloud Server Deployment Checklist**  
**Version:** 1.0.0  
**Status:** COMPLETE
