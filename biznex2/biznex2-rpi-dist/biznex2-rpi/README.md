# Biznex2 - Multi-Store POS System

**Biznex2** is a modern, multi-store Point of Sale and Inventory Management system designed for both **Windows laptops** and **Raspberry Pi kiosks**.

## 🌟 Features

- ✅ **No License Activation** - Works out of the box
- ✅ **First-Time Admin Setup** - Create admin credentials on first launch
- ✅ **Multi-Store System** - Manage multiple store locations from one system
- ✅ **POS Interface** - Fast, intuitive checkout
- ✅ **Inventory Management** - Real-time stock tracking
- ✅ **Order History** - Complete transaction records
- ✅ **Cross-Platform** - Windows Electron app or Raspberry Pi web app
- ✅ **Responsive Design** - Works on desktop and touch screens

## 📋 System Requirements

### Windows (Laptop/Desktop)
- Windows 10 or later
- Node.js 18+ (included in Electron build)
- 500MB free space

### Raspberry Pi
- Raspberry Pi 3B+ or later (4B+ recommended)
- Raspberry Pi OS (Debian-based)
- 2GB RAM minimum, 4GB recommended
- 1GB free disk space

## 🚀 Installation

### Windows Installation

1. **Download Node.js** (if not already installed):
   - Download from: https://nodejs.org/ (18 LTS or newer)
   - Run the installer

2. **Run Installation Script**:
   ```bash
   cd biznex2
   scripts\install-windows.bat
   ```
   - Right-click and select "Run as Administrator"
   - Wait for dependencies to install

3. **Start Biznex2**:
   - Click the "Biznex2" shortcut on your Desktop
   - Or run: `npm start` from the biznex2 directory

4. **First-Time Setup**:
   - You'll see the Setup Wizard
   - Create your Admin username, email, and password
   - Set your business/store name
   - Click "Complete Setup"

### Raspberry Pi Installation

1. **SSH into your Raspberry Pi**:
   ```bash
   ssh pi@raspberrypi.local
   ```

2. **Download and Run Installation**:
   ```bash
   git clone <repo-url> biznex2
   cd biznex2
   sudo bash rpi/install.sh
   ```

   Or if you have the files on USB:
   ```bash
   sudo bash /path/to/biznex2/rpi/install.sh
   ```

3. **Access Biznex2**:
   - Open any browser on the network
   - Go to: `http://raspberrypi.local:3000`
   - Or use the Pi's IP: `http://192.168.x.x:3000`

4. **First-Time Setup**:
   - Complete the admin setup wizard
   - Start managing your business!

## 💻 Using Biznex2

### First-Time Setup
1. Enter your business/store name
2. Create admin credentials (username & password)
3. Click "Complete Setup"
4. You're ready to go!

### Main Features

#### Dashboard
- View total sales
- See number of orders
- Check total inventory

#### POS (Point of Sale)
- Click products to add to cart
- Adjust quantities
- Enter customer name (optional)
- Select payment method (Cash/Card/Cheque)
- Complete the sale

#### Products
- Add new products with:
  - Product name
  - SKU (optional)
  - Price and cost price
  - Stock quantity
  - Category
- View all products in a sortable table

#### Orders
- View complete order history
- See customer name, items, total, payment method
- Filter by date

#### Stores (Multi-Store)
- Add multiple store locations
- Each store has its own:
  - Inventory
  - Products
  - User accounts
  - Order history
- Manage all stores from the admin panel

#### Settings
- View app information
- Logout from your account

## 🔧 Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Running in Development Mode

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Create .env File**:
   ```bash
   cp .env.example .env
   ```

3. **Start Server**:
   ```bash
   npm run dev:server
   ```

4. **In another terminal, start Electron**:
   ```bash
   npm run dev
   ```

### Available Commands

```bash
# Development
npm run dev              # Run Electron with auto-reload
npm run dev:server      # Run server with nodemon
npm start:server        # Start server manually
npm start:rpi          # Start server for Raspberry Pi

# Building
npm run build:win       # Build Windows installer
npm run build:rpi       # Build Raspberry Pi package
npm pack               # Create dev package

# Utilities
npm test               # Run tests
npm run lint          # Check code style
npm run backup:db     # Backup database
```

## 📁 Project Structure

```
biznex2/
├── client/                 # Web frontend (HTML/CSS/JS)
│   ├── index.html        # Main app interface
│   ├── style.css         # Styling
│   └── app.js            # Frontend logic
├── server/                 # Backend server
│   ├── server.js         # Main Express server
│   ├── server-rpi.js     # Raspberry Pi variant
│   ├── db.js             # Database management
│   └── routes/           # API routes
├── electron-shell/         # Windows Electron app
│   ├── main.js           # Electron entry point
│   └── preload.js        # Security preload
├── rpi/                    # Raspberry Pi files
│   ├── install.sh        # Installation script
│   ├── uninstall.sh      # Uninstall script
│   └── ecosystem.config.js # PM2 configuration
├── scripts/                # Build & utility scripts
├── package.json          # Project metadata
└── README.md             # This file
```

## 🗄️ Database

Biznex2 uses **SQLite** by default for easy portability.

### Database Files
- **Windows**: `C:\Users\[YourUsername]\AppData\Local\Biznex2\database.db`
- **Raspberry Pi**: `/home/pi/.biznex2/biznex2.db`

### Tables
- `system_settings` - App configuration
- `stores` - Store management
- `users` - User accounts
- `products` - Product catalog
- `orders` - Order history
- `order_items` - Line items in orders
- `categories` - Product categories
- `stock_movements` - Inventory changes

## 🔐 Security

- JWT-based authentication
- Password hashing with bcryptjs
- Helmet.js for HTTP headers
- Rate limiting on API endpoints
- CORS properly configured
- No hardcoded credentials

## 🌐 Network Access

### Windows
- Local: `http://localhost:3000`
- Network: `http://<computer-name>:3000` or `http://<ip-address>:3000`

### Raspberry Pi
- Local: `http://localhost:3000`
- Network: `http://raspberrypi.local:3000` or `http://<pi-ip>:3000`

## 📊 Multi-Store Features

Each store operates independently with:
- Separate user accounts
- Isolated product inventories
- Individual sales records
- Dedicated order history

Switch between stores through the "Stores" menu in the admin panel.

## 🆘 Troubleshooting

### Windows Issues

**"npm is not recognized"**
- Install Node.js from https://nodejs.org/
- Restart your computer after installation
- Run the installation script again

**Port 3000 already in use**
- Change PORT in .env: `PORT=3001`
- Or kill the process using port 3000

**Cannot connect to database**
- Ensure `C:\Users\[User]\AppData\Local\Biznex2\` exists
- Check folder permissions
- Delete the database file to reset

### Raspberry Pi Issues

**"Permission denied" on install script**
- Make script executable: `chmod +x rpi/install.sh`
- Run with sudo: `sudo bash rpi/install.sh`

**Cannot access from other machines**
- Check firewall: `sudo ufw allow 3000`
- Verify Pi IP: `hostname -I`
- Check network connectivity: `ping <pi-ip>`

**"Node.js not found"**
- Install Node.js: `curl -sL https://deb.nodesource.com/setup_18.x | sudo bash -`
- Then: `sudo apt-get install -y nodejs`

**"PM2 is not recognized"**
- Install globally: `sudo npm install -g pm2`
- Setup startup: `pm2 startup`

## 📈 Performance Tips

- Use Raspberry Pi 4B+ for better performance
- Keep database size under 500MB
- Archive old orders periodically
- Close unused browser tabs accessing the app
- Ensure good network connectivity

## 🔄 Backup & Recovery

### Windows
- Database backup: Copy from AppData\Local\Biznex2\
- Settings preserved in .env

### Raspberry Pi
- Data stored in `/home/pi/.biznex2/`
- Use: `tar -czf biznex2-backup.tar.gz /home/pi/.biznex2/`
- To restore: `tar -xzf biznex2-backup.tar.gz -C /`

## 📞 Support

For issues or questions:
1. Check logs (Windows: AppData/Local/Biznex2/logs or Pi: ~/.biznex2/logs)
2. Review error messages in browser console (F12)
3. Ensure Node.js and dependencies are up to date
4. Try uninstalling and reinstalling

## 📝 License

ISC - See LICENSE file

## 🎉 Getting Started Checklist

- [ ] Install Node.js (if Windows)
- [ ] Run installation script
- [ ] Start Biznex2
- [ ] Complete first-time admin setup
- [ ] Add your store information
- [ ] Add sample products
- [ ] Make a test sale
- [ ] Explore multi-store features
- [ ] Access from another device on your network

---

**Biznex2 v2.0.0** - Ready for your demo tomorrow! 🚀
