# Changelog

All notable changes to League Toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2025-01-02

### 🎉 Major Release - Complete Rewrite

#### Added
- ✨ **Complete Electron App** - Professional desktop application
- 🎯 **Auto Accept** - Automatically accept queue matches
- 🎮 **Auto Pick** - Auto-lock champions with random support
- 🚫 **Auto Ban** - Auto-ban champions with ally protection
- 👤 **Profile Customization** - Icons, backgrounds, Riot ID, status
- 📊 **Match History** - Last 20 matches with detailed stats
- 📈 **Statistics Dashboard** - KDA, winrate, champion stats
- 🧮 **Elo Calculator** - Games needed to next rank
- 🔍 **Reveal Lobby** - Open Porofessor.gg with team info
- ⚡ **Dodge** - Leave champion select instantly
- 💬 **Chat Toggle** - Disconnect/reconnect from chat
- 👥 **Remove Friends** - Bulk friend removal
- 🔄 **Restart Client** - Restart League client UX
- 📝 **Logging System** - Real-time logs with filtering
- 💾 **Smart Caching** - Optimized performance with cache
- 🔌 **Auto-Reconnect** - Detect client restarts automatically

#### Services Architecture
- **LCUService** - Robust LCU API connection with error handling
- **FeatureService** - Modular feature implementation
- **SummonerService** - Player data management with validation
- **MatchService** - Match history and aggregation
- **StatsService** - Elo calculations and statistics
- **LogService** - Professional logging system

#### UI/UX
- 🎨 Modern dark theme interface
- 📱 Responsive design
- 🖼️ Custom titlebar with window controls
- 🔔 Real-time status indicators
- ⚙️ Settings panel
- 📊 Statistics visualizations
- 🎯 Feature toggle switches

#### Documentation
- 📖 **README.md** - Complete project documentation
- 🚀 **QUICKSTART.md** - 5-minute quick start guide
- 🔧 **ERRORS_AND_FIXES.md** - Comprehensive troubleshooting
- 📜 **LICENSE** - MIT License
- 📋 **CHANGELOG.md** - This file

#### Developer Experience
- 🛠️ **verify-project.js** - Project verification script
- 📦 **Electron Builder** - Multi-platform build support
- 🐍 **Python Scripts** - Optional Python integration
- 🔍 **DevTools** - Built-in debugging support
- 📝 **Code Comments** - Well-documented codebase

#### Platform Support
- ✅ Windows 10/11
- ✅ MacOS 10.15+
- ✅ Linux (Ubuntu, Fedora, etc)

---

## [1.0.0] - Previous Version

### Features
- Basic Python scripts for LCU interaction
- Individual feature scripts
- Command-line interface
- Manual execution

### Scripts Included
- `AutoAccept.py` - Auto accept matches
- `Backgrounds.py` - Change profile backgrounds
- `Badges.py` - Modify profile badges
- `Icons.py` - Change profile icons
- `Dodge.py` - Dodge champion select
- `Reveal.py` - Reveal lobby information
- `StatusChanger.py` - Change status message
- `Riotidchanger.py` - Change Riot ID
- `RemoveFriends.py` - Remove all friends
- `RestartUX.py` - Restart client
- `disconnect_reconnect_chat.py` - Chat control
- `Rengar.py` - Core LCU connection
- `api_bridge.py` - Python-JavaScript bridge

---

## Planned Features (Roadmap)

### v2.1.0 (Next Minor Release)
- [ ] Champion mastery display
- [ ] Skin collection viewer
- [ ] Honor level tracking
- [ ] Clash schedule integration
- [ ] Theme customization options

### v2.2.0
- [ ] Discord Rich Presence
- [ ] Multiple account profiles
- [ ] Saved configurations (presets)
- [ ] Advanced filtering in match history
- [ ] Export statistics to CSV/JSON

### v2.3.0
- [ ] Plugin system for extensions
- [ ] WebSocket real-time updates
- [ ] Live game spectator info
- [ ] Post-game analysis
- [ ] Champion recommendations based on stats

### v3.0.0 (Major Update)
- [ ] Web dashboard (optional)
- [ ] Mobile companion app
- [ ] Team coordination features
- [ ] Advanced analytics with ML
- [ ] Integration with external APIs (OP.GG, U.GG)

---

## Breaking Changes

### From v1.x to v2.0
- Complete migration from Python CLI to Electron app
- New architecture with services
- Different configuration format
- New API for extensions

### Migration Guide (v1.x → v2.0)

If you're upgrading from Python scripts:

1. **Install Node.js** (required for v2.0)
2. **Run** `npm install` in project folder
3. **Start** with `npm start`
4. **Old Python scripts** are still available in `python-scripts/` folder

No configuration migration needed - v2.0 auto-detects LCU.

---

## Known Issues

### v2.0.0
- Icon assets not included (see `assets/README.md`)
- Some champion names require specific formatting (see ERRORS_AND_FIXES.md)
- Windows Defender may flag as unknown app (normal for unsigned apps)
- First launch may be slower while loading champion data

### Workarounds
- For icon issue: Use default Electron icon or add custom icons
- For champion names: Check ERRORS_AND_FIXES.md for correct formatting
- For Defender: Click "More info" → "Run anyway"
- For slow launch: Champion data is cached after first load

---

## Contributors

### Core Team
- **LTK Team** - Main development

### Special Thanks
- Riot Games - For creating League of Legends
- Community Dragon - For champion/skin data APIs
- Electron Team - For the amazing framework
- League Community - For feedback and testing

---

## Support

### Reporting Bugs
- 🐛 [GitHub Issues](https://github.com/yourusername/league-toolkit/issues)
- Include: Version, OS, error logs, steps to reproduce

### Feature Requests
- 💡 [GitHub Discussions](https://github.com/yourusername/league-toolkit/discussions)
- Describe the feature and use case

### Community
- 💬 Discord: [Join Server]
- 📧 Email: support@leaguetoolkit.com

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Disclaimer

This project is **NOT** affiliated with, endorsed by, or associated with **Riot Games, Inc.**

League of Legends and all related content are trademarks or registered trademarks of Riot Games, Inc.

**USE AT YOUR OWN RISK.**

---

[Unreleased]: https://github.com/yourusername/league-toolkit/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/yourusername/league-toolkit/releases/tag/v2.0.0
[1.0.0]: https://github.com/yourusername/league-toolkit/releases/tag/v1.0.0
