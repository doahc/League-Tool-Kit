const fs = require('fs');
const path = require('path');

/**
 * Script de Verificação do Projeto LTK
 * Verifica se todos os arquivos necessários existem
 */

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

console.log(`${colors.cyan}${colors.bold}`);
console.log('╔════════════════════════════════════════╗');
console.log('║   LTK Project Structure Verification  ║');
console.log('╚════════════════════════════════════════╝');
console.log(colors.reset);

// Arquivos obrigatórios
const requiredFiles = [
    { path: 'package.json', name: 'Package Configuration' },
    { path: 'main.js', name: 'Main Process' },
    { path: 'preload.js', name: 'Preload Script' },
    { path: 'index.html', name: 'Main HTML' },
    { path: 'styles.css', name: 'Stylesheets' },
    { path: 'app.js', name: 'Frontend Logic' }
];

// Diretórios obrigatórios
const requiredDirs = [
    { path: 'services', name: 'Services Directory' },
    { path: 'utils', name: 'Utils Directory' },
    { path: 'assets', name: 'Assets Directory' }
];

// Services obrigatórios
const requiredServices = [
    { path: 'services/LCUService.js', name: 'LCU Service' },
    { path: 'services/SummonerService.js', name: 'Summoner Service' },
    { path: 'services/FeatureService.js', name: 'Feature Service' },
    { path: 'services/MatchService.js', name: 'Match Service' },
    { path: 'services/StatsService.js', name: 'Stats Service' },
    { path: 'services/LogService.js', name: 'Log Service' },
    { path: 'services/UpdateService.js', name: 'Update Service ⭐' }
];

// Utils obrigatórios
const requiredUtils = [
    { path: 'utils/LogThrottle.js', name: 'Log Throttle' }
];

let hasErrors = false;
let warnings = [];

/**
 * Verificar arquivo
 */
function checkFile(filePath, name, required = true) {
    const fullPath = path.join(process.cwd(), filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
        console.log(`${colors.green}✓${colors.reset} ${name.padEnd(30)} (${filePath})`);
        return true;
    } else {
        if (required) {
            console.log(`${colors.red}✗${colors.reset} ${name.padEnd(30)} ${colors.red}MISSING${colors.reset}`);
            hasErrors = true;
        } else {
            console.log(`${colors.yellow}!${colors.reset} ${name.padEnd(30)} ${colors.yellow}OPTIONAL${colors.reset}`);
            warnings.push(`Optional file missing: ${filePath}`);
        }
        return false;
    }
}

/**
 * Verificar diretório
 */
function checkDir(dirPath, name) {
    const fullPath = path.join(process.cwd(), dirPath);
    const exists = fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
    
    if (exists) {
        console.log(`${colors.green}✓${colors.reset} ${name.padEnd(30)} (${dirPath}/)`);
        return true;
    } else {
        console.log(`${colors.red}✗${colors.reset} ${name.padEnd(30)} ${colors.red}MISSING${colors.reset}`);
        hasErrors = true;
        return false;
    }
}

/**
 * Verificar package.json
 */
function checkPackageJson() {
    try {
        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        console.log(`\n${colors.cyan}Package.json Details:${colors.reset}`);
        console.log(`  Name: ${pkg.name}`);
        console.log(`  Version: ${pkg.version}`);
        console.log(`  Main: ${pkg.main}`);
        
        // Verificar dependências críticas
        const criticalDeps = ['electron', 'electron-updater'];
        const missingDeps = criticalDeps.filter(dep => !pkg.dependencies || !pkg.dependencies[dep]);
        
        if (missingDeps.length > 0) {
            console.log(`\n${colors.red}Missing dependencies:${colors.reset}`);
            missingDeps.forEach(dep => {
                console.log(`  ${colors.red}✗${colors.reset} ${dep}`);
            });
            hasErrors = true;
        }
        
        return true;
    } catch (error) {
        console.log(`${colors.red}Error reading package.json:${colors.reset} ${error.message}`);
        hasErrors = true;
        return false;
    }
}

// ==================== VERIFICAÇÃO ====================

console.log(`${colors.bold}Checking Root Files:${colors.reset}`);
requiredFiles.forEach(file => checkFile(file.path, file.name));

console.log(`\n${colors.bold}Checking Directories:${colors.reset}`);
requiredDirs.forEach(dir => checkDir(dir.path, dir.name));

console.log(`\n${colors.bold}Checking Services:${colors.reset}`);
requiredServices.forEach(service => checkFile(service.path, service.name));

console.log(`\n${colors.bold}Checking Utils:${colors.reset}`);
requiredUtils.forEach(util => checkFile(util.path, util.name));

console.log(`\n${colors.bold}Checking Optional Assets:${colors.reset}`);
checkFile('assets/icon.ico', 'Windows Icon', false);
checkFile('assets/icon.icns', 'macOS Icon', false);
checkFile('assets/icon.png', 'Linux Icon', false);

// Verificar package.json em detalhes
console.log('');
checkPackageJson();

// ==================== RESULTADO ====================

console.log('\n' + colors.cyan + colors.bold);
console.log('═══════════════════════════════════════════');
console.log('              VERIFICATION RESULT          ');
console.log('═══════════════════════════════════════════');
console.log(colors.reset);

if (hasErrors) {
    console.log(`${colors.red}${colors.bold}✗ FAILED${colors.reset}`);
    console.log(`${colors.red}Some required files or directories are missing!${colors.reset}`);
    console.log(`\nPlease ensure all required files exist before running the application.`);
    process.exit(1);
} else {
    console.log(`${colors.green}${colors.bold}✓ PASSED${colors.reset}`);
    console.log(`${colors.green}All required files and directories are present!${colors.reset}`);
    
    if (warnings.length > 0) {
        console.log(`\n${colors.yellow}Warnings (${warnings.length}):${colors.reset}`);
        warnings.forEach(warning => {
            console.log(`  ${colors.yellow}!${colors.reset} ${warning}`);
        });
    }
    
    console.log(`\n${colors.cyan}Ready to run! Use:${colors.reset}`);
    console.log(`  ${colors.bold}npm start${colors.reset}     - Run in development`);
    console.log(`  ${colors.bold}npm run build${colors.reset} - Build for production`);
}

console.log('');