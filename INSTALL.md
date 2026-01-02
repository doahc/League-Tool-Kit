# 📥 Installation Guide

Complete step-by-step installation guide for League Toolkit.

---

## 📋 System Requirements

### Minimum Requirements
- **OS:** Windows 10 (64-bit), MacOS 10.15+, or Linux
- **RAM:** 2GB available
- **Storage:** 500MB free space
- **League of Legends:** Installed and updated

### Recommended Requirements
- **OS:** Windows 11, MacOS 12+, or Ubuntu 22.04+
- **RAM:** 4GB+ available
- **Storage:** 1GB+ free space
- **Internet:** For downloading dependencies

---

## 🚀 Quick Install (Recommended)

### Option 1: Use Pre-built Executable (Coming Soon)

Download the latest release for your platform:

**Windows:**
```
Download: LTK-Setup-2.0.0.exe
Run the installer
Follow on-screen instructions
```

**MacOS:**
```
Download: LTK-2.0.0.dmg
Open the DMG file
Drag LTK to Applications
Launch from Applications
```

**Linux:**
```bash
# Download LTK-2.0.0.AppImage
chmod +x LTK-2.0.0.AppImage
./LTK-2.0.0.AppImage
```

---

## 🛠️ Build from Source

### Step 1: Install Prerequisites

#### Windows

1. **Install Node.js**
   ```
   Visit: https://nodejs.org/
   Download: LTS version (18.x or 20.x)
   Run the installer
   ✅ Check "Add to PATH"
   ```

2. **Verify Installation**
   ```bash
   # Open Command Prompt or PowerShell
   node --version   # Should show v18.x.x or v20.x.x
   npm --version    # Should show 9.x.x or 10.x.x
   ```

3. **Optional: Install Git**
   ```
   Visit: https://git-scm.com/download/win
   Download and install
   ```

#### MacOS

1. **Install Homebrew** (if not installed)
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

2. **Install Node.js**
   ```bash
   brew install node@20
   ```

3. **Verify**
   ```bash
   node --version
   npm --version
   ```

#### Linux (Ubuntu/Debian)

```bash
# Update packages
sudo apt update

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version
npm --version
```

---

### Step 2: Get the Source Code

#### Option A: Download ZIP

1. Go to GitHub repository
2. Click "Code" → "Download ZIP"
3. Extract to desired location
4. Open terminal in extracted folder

#### Option B: Clone with Git

```bash
# Clone repository
git clone https://github.com/yourusername/league-toolkit.git

# Navigate to folder
cd league-toolkit
```

---

### Step 3: Install Dependencies

```bash
# In the league-toolkit folder
npm install
```

**What this does:**
- Downloads Electron framework
- Installs electron-builder
- Sets up the project

**Estimated time:** 2-5 minutes (depending on internet speed)

**Troubleshooting:**
```bash
# If npm install fails, try:
npm cache clean --force
npm install --legacy-peer-deps

# If still fails, delete and retry:
rm -rf node_modules
npm install
```

---

### Step 4: Verify Installation

```bash
npm run verify
```

**Expected output:**
```
🔍 League Toolkit - Project Verification
==================================================

📄 Core Files:
  ✓ package.json
  ✓ main.js
  ✓ preload.js
  ✓ app.js
  ✓ index.html
  ✓ styles.css

📚 Documentation:
  ✓ README.md
  ✓ LICENSE
  ✓ QUICKSTART.md

⚙️ Services:
  ✓ services/
  ✓ LCUService.js
  ✓ FeatureService.js
  ... etc

📊 Verification Summary:
✅ Perfect! All files present.
```

---

### Step 5: Run the Application

```bash
npm start
```

**First launch:**
- May take 10-15 seconds to start
- Window will appear with LTK interface
- "LCU not connected" is normal if League isn't running

**To use:**
1. Open League of Legends
2. Log in normally
3. LTK will auto-detect and show "✅ Connected"

---

## 🏗️ Building Executables

### Build for Your Platform

#### Windows
```bash
npm run build:win
```

**Output:**
- `dist/LTK Setup 2.0.0.exe` - Installer
- `dist/LTK 2.0.0.exe` - Portable version

**Install:**
1. Run "LTK Setup 2.0.0.exe"
2. Follow installer wizard
3. Launch from Start Menu or Desktop

**Portable:**
- No installation needed
- Run "LTK 2.0.0.exe" directly
- Can run from USB drive

#### MacOS
```bash
npm run build:mac
```

**Output:**
- `dist/LTK-2.0.0.dmg` - Disk image
- `dist/LTK-2.0.0-mac.zip` - ZIP archive

**Install:**
1. Open DMG file
2. Drag LTK to Applications
3. Launch from Applications (may need to allow in System Preferences → Security)

#### Linux
```bash
npm run build:linux
```

**Output:**
- `dist/LTK-2.0.0.AppImage` - Portable executable
- `dist/ltk_2.0.0_amd64.deb` - Debian package

**Install (AppImage):**
```bash
chmod +x LTK-2.0.0.AppImage
./LTK-2.0.0.AppImage
```

**Install (DEB):**
```bash
sudo dpkg -i ltk_2.0.0_amd64.deb
```

---

## 🐍 Optional: Python Scripts

The Python scripts are **optional** and are already integrated into the main app.

However, if you want to use them standalone:

### Install Python Dependencies

```bash
# Navigate to python-scripts folder
cd python-scripts

# Install requirements
pip install -r requirements.txt

# Or install individually
pip install psutil requests termcolor
```

### Run Python Scripts

```bash
# Example: Change icon
python Icons.py

# Example: Auto accept
python AutoAccept.py
```

---

## ⚙️ Configuration

### First Launch Setup

1. **Open League of Legends**
   - Must be logged in
   - Wait until you see the main menu

2. **Launch LTK**
   - It will auto-detect the client
   - Your profile will load automatically

3. **Allow Firewall** (if prompted)
   - LTK needs to communicate with local League client
   - This is safe (localhost only)

### Optional Settings

Access via Settings icon in app:
- Toggle features on/off
- Clear cache
- View logs folder
- Check for updates

---

## 🔧 Troubleshooting Installation

### "node: command not found"

**Cause:** Node.js not installed or not in PATH

**Solution:**
```bash
# Windows: Reinstall Node.js, ensure "Add to PATH" is checked
# Mac: brew install node
# Linux: Follow Step 1 again
```

### "npm ERR! code EACCES"

**Cause:** Permission issues (Mac/Linux)

**Solution:**
```bash
# Fix npm permissions
sudo chown -R $USER:$GROUP ~/.npm
sudo chown -R $USER:$GROUP ~/.config
```

### "Cannot find module 'electron'"

**Cause:** Dependencies not installed properly

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Python not found" (Python scripts only)

**Cause:** Python not installed

**Solution:**
- Windows: https://www.python.org/downloads/
- Mac: `brew install python3`
- Linux: `sudo apt install python3 python3-pip`

### Build fails with "gyp ERR!"

**Cause:** Native build tools missing

**Windows Solution:**
```bash
npm install --global windows-build-tools
```

**Mac Solution:**
```bash
xcode-select --install
```

**Linux Solution:**
```bash
sudo apt-get install build-essential
```

---

## 📦 Uninstallation

### Windows (Installed version)
1. Open "Add or Remove Programs"
2. Find "LTK"
3. Click "Uninstall"

### Windows (Portable)
- Simply delete the folder

### MacOS
1. Open Applications
2. Drag LTK to Trash
3. Empty Trash

### Linux
```bash
# AppImage
rm LTK-2.0.0.AppImage

# DEB package
sudo apt remove ltk
```

### Clean User Data

If you want to remove all user data:

**Windows:**
```
%APPDATA%/league-toolkit
```

**Mac:**
```
~/Library/Application Support/league-toolkit
```

**Linux:**
```
~/.config/league-toolkit
```

---

## 🆘 Getting Help

### Installation Issues

1. **Check prerequisites** - Node.js installed?
2. **Read error message** - Usually tells what's wrong
3. **Check ERRORS_AND_FIXES.md** - Common solutions
4. **Google the error** - Often has solutions
5. **Ask for help** - GitHub Issues

### Support Channels

- 📖 **Documentation:** README.md, QUICKSTART.md
- 🐛 **Bug Reports:** GitHub Issues
- 💬 **Questions:** GitHub Discussions
- 📧 **Email:** support@leaguetoolkit.com

---

## ✅ Installation Checklist

Before using LTK, verify:

- [ ] Node.js installed (v18+)
- [ ] Dependencies installed (`npm install`)
- [ ] Project verified (`npm run verify`)
- [ ] App starts successfully (`npm start`)
- [ ] League of Legends installed and working
- [ ] Firewall allows local connections (localhost)

---

## 🎉 Installation Complete!

You're now ready to use League Toolkit!

**Next steps:**
1. Read [QUICKSTART.md](QUICKSTART.md) for usage guide
2. Start League of Legends
3. Launch LTK
4. Enjoy automated features!

**Having issues?** Check [ERRORS_AND_FIXES.md](ERRORS_AND_FIXES.md)

---

<div align="center">

**Happy Gaming! 🎮**

[📖 Back to README](README.md) | [🚀 Quick Start](QUICKSTART.md) | [🔧 Troubleshooting](ERRORS_AND_FIXES.md)

</div>
