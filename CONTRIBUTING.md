# Contributing to League Toolkit

First off, thank you for considering contributing to League Toolkit! 🎉

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Guidelines](#coding-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

---

## Code of Conduct

This project follows a Code of Conduct. By participating, you are expected to uphold this code:

- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

---

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title** - Descriptive and specific
- **Steps to reproduce** - Detailed list
- **Expected behavior** - What should happen
- **Actual behavior** - What actually happens
- **Screenshots** - If applicable
- **Environment** - OS, Node version, LTK version
- **Logs** - From the Logs tab

**Template:**
```markdown
## Bug Description
Brief description of the bug

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
What you expected to happen

## Actual Behavior
What actually happened

## Environment
- OS: Windows 11
- Node.js: v18.17.0
- LTK Version: 2.0.0
- League Version: 14.1

## Logs
```
Paste relevant logs here
```
```

### 💡 Suggesting Features

Feature suggestions are welcome! Please:

1. **Check existing suggestions** first
2. **Describe the feature** clearly
3. **Explain the use case** - Why is it needed?
4. **Consider alternatives** - Are there other solutions?
5. **Add mockups** if applicable

---

## Development Setup

### Prerequisites

```bash
# Required
Node.js 18+
npm or yarn
Git

# Optional (for Python scripts)
Python 3.8+
pip
```

### Setup Steps

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/league-toolkit.git
cd league-toolkit

# 2. Install dependencies
npm install

# 3. Verify project
npm run verify

# 4. Start development
npm run dev
```

### Development Commands

```bash
# Start with DevTools
npm run dev

# Start normally
npm start

# Verify project structure
npm run verify

# Build for testing
npm run pack

# Build for production
npm run build

# Platform-specific builds
npm run build:win    # Windows
npm run build:mac    # MacOS
npm run build:linux  # Linux
```

---

## Project Structure

```
league-toolkit/
├── main.js              # Electron main process
├── preload.js           # IPC bridge (security)
├── app.js               # Renderer process logic
├── index.html           # Main UI
├── styles.css           # Styling
│
├── services/            # Core services
│   ├── LCUService.js   # LCU connection
│   ├── FeatureService.js  # Features implementation
│   ├── SummonerService.js # Player data
│   ├── MatchService.js    # Match history
│   ├── StatsService.js    # Statistics
│   └── LogService.js      # Logging
│
├── utils/               # Utilities
│   └── LogThrottle.js  # Log throttling
│
├── python-scripts/      # Optional Python integration
│   └── *.py            # Various scripts
│
└── assets/             # Static resources
    └── icon.*          # App icons
```

---

## Coding Guidelines

### JavaScript Style

```javascript
// ✅ Good
async function fetchData() {
    try {
        const response = await api.get('/endpoint');
        return response.data;
    } catch (error) {
        console.error('Failed to fetch:', error);
        return null;
    }
}

// ❌ Bad
function fetchData() {
    api.get('/endpoint').then(response => {
        return response.data;
    }).catch(error => {
        console.error(error);
    });
}
```

### Key Principles

1. **Async/Await** over Promises chains
2. **Try/Catch** for error handling
3. **Descriptive names** for variables/functions
4. **Comments** for complex logic
5. **Consistent formatting** (2 spaces, semicolons)
6. **No console.log** in production (use LogService)

### Service Pattern

```javascript
class MyService {
    constructor(dependencies) {
        this.dependency = dependencies;
        this.cache = {};
    }

    async fetchSomething() {
        // Check cache first
        if (this.cache.data) {
            return this.cache.data;
        }

        try {
            const data = await this.dependency.get('/endpoint');
            this.cache.data = data;
            return data;
        } catch (error) {
            console.error('[MyService] Error:', error);
            return null;
        }
    }

    clearCache() {
        this.cache = {};
    }
}
```

### Error Handling

```javascript
// ✅ Always handle errors gracefully
async function safeOperation() {
    try {
        const result = await riskyOperation();
        return { success: true, data: result };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ✅ Provide fallbacks
const data = await fetchData() || getDefaultData();

// ✅ Log errors appropriately
services.log.error('Module', 'Operation failed', error.message);
```

---

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples

```bash
# Good commits
feat(auto-pick): add random champion selection
fix(lcu): handle connection timeout errors
docs(readme): update installation instructions
refactor(services): extract champion data logic

# Detailed commit
feat(stats): add elo calculator

- Implement LP calculation algorithm
- Add UI for input and display
- Handle edge cases (Master+)
- Add unit tests

Closes #123
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows the style guidelines
- [ ] Comments added for complex code
- [ ] Documentation updated if needed
- [ ] Tested locally with League client
- [ ] No console.log statements left
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?
- [ ] Tested with League client running
- [ ] Tested feature A
- [ ] Tested feature B

## Screenshots
If applicable, add screenshots

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. **Submit PR** with clear description
2. **Wait for review** (usually 1-3 days)
3. **Address feedback** if requested
4. **Approval** by maintainer
5. **Merge** into main

---

## Testing Guidelines

### Manual Testing

Before submitting, test:

```bash
# 1. Fresh install
rm -rf node_modules
npm install
npm start

# 2. Core features
- [ ] LCU connection detection
- [ ] Auto Accept works
- [ ] Auto Pick/Ban works
- [ ] Profile changes work
- [ ] Stats display correctly
- [ ] Logs show properly

# 3. Error handling
- [ ] Works without League running
- [ ] Reconnects after League restart
- [ ] Handles invalid champion names
- [ ] Shows appropriate error messages
```

### Testing Checklist

#### LCU Connection
- [ ] Detects League when opened
- [ ] Shows disconnect when closed
- [ ] Reconnects automatically

#### Auto Features
- [ ] Auto Accept activates/deactivates
- [ ] Auto Pick locks correct champion
- [ ] Auto Ban respects ally hovers
- [ ] Random pick selects owned champion

#### Profile
- [ ] Icon changes properly
- [ ] Background changes properly
- [ ] Riot ID changes properly
- [ ] Status changes properly

#### Stats
- [ ] Match history loads
- [ ] Statistics calculate correctly
- [ ] Elo calculator works
- [ ] Champion stats display

---

## Architecture Decisions

### Why Electron?
- Cross-platform support
- Familiar web technologies
- Easy UI development
- Good performance

### Why Services Pattern?
- Separation of concerns
- Easier testing
- Maintainable code
- Reusable logic

### Why Not Redux/Vuex?
- Overkill for current size
- Direct IPC is simpler
- Easier for contributors
- Can add later if needed

---

## Need Help?

### Resources

- 📖 [Electron Docs](https://www.electronjs.org/docs)
- 📖 [LCU API Docs](https://riot-api-libraries.readthedocs.io/)
- 💬 [Discord](https://discord.gg/YOUR_SERVER)
- 📧 [Email](mailto:dev@leaguetoolkit.com)

### Getting Started

1. Read this document fully
2. Set up development environment
3. Pick a good first issue
4. Ask questions if stuck
5. Submit your first PR!

### Good First Issues

Look for issues labeled:
- `good first issue` - Perfect for beginners
- `help wanted` - Community help needed
- `documentation` - Improve docs
- `bug` - Fix existing bugs

---

## Recognition

Contributors will be:
- Added to README.md
- Mentioned in CHANGELOG.md
- Credited in release notes
- Featured on website (future)

---

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to League Toolkit! 🎮⚡

Questions? Open a discussion on GitHub!
