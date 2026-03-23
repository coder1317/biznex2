# Biznex2 Raspberry Pi Installation

## Quick Start (2 minutes)

### 1. Extract the package
```bash
tar -xzf biznex2-rpi-2.0.0.tar.gz
cd biznex2-rpi
```

### 2. Run the installer
```bash
chmod +x rpi/install.sh
./rpi/install.sh
```

### 3. Access Biznex2
- **URL**: http://raspberrypi.local:3000 (or http://[PI_IP]:3000)
- **First Time**: Setup wizard will appear
- **Create Admin Credentials**: Username & Password (NO license key!)

## Detailed Installation

**Prerequisites**:
- Raspberry Pi OS (Bullseye or newer)
- SSH access enabled
- Internet connection

**Step-by-Step**:
1. `tar -xzf biznex2-rpi-2.0.0.tar.gz && cd biznex2-rpi`
2. `sudo chmod +x rpi/install.sh && sudo ./rpi/install.sh`
3. Wait for installation to complete (3-5 minutes)
4. Reboot: `sudo reboot`
5. Open browser: `http://raspberrypi.local:3000`

## Post-Installation

### Start/Stop Service
```bash
pm2 stop biznex2          # Stop
pm2 start biznex2         # Start  
pm2 status                # Check status
pm2 logs biznex2          # View logs
```

### Uninstall
```bash
cd biznex2-rpi
sudo chmod +x rpi/uninstall.sh
sudo ./rpi/uninstall.sh
```

### Load Demo Data
```bash
npm run demo-data
```

## Troubleshooting

**Can't access on network**: Check firewall, ensure Pi has static IP
**Service won't start**: Check logs: `pm2 logs`  
**Database errors**: Clear and reinitialize: `npm run demo-data`
**Port 3000 in use**: Change PORT env var in .env file

## Features

✅ Multi-store management  
✅ POS system with cart  
✅ Product inventory  
✅ Order history  
✅ Dashboard analytics  
✅ No license key required  
✅ First-time admin setup  

## Support

For issues or questions: https://github.com/coder1317/biznex2

---
**Version**: 2.0.0  
**Built**: $(date)  
**Ready for Raspberry Pi deployment**
