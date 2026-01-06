const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function execFileAsync(file, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(file, args, options, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

function findRiotClientServicesPath() {
    const override = process.env.LTK_RIOT_CLIENT_PATH;
    if (override && fileExists(override)) return override;

    const candidates = [
        path.join('C:', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
        path.join(process.env['ProgramFiles'] || '', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
        path.join(process.env['ProgramFiles(x86)'] || '', 'Riot Games', 'Riot Client', 'RiotClientServices.exe'),
    ].filter(Boolean);

    for (const candidate of candidates) {
        if (candidate && fileExists(candidate)) return candidate;
    }

    return null;
}

async function killRiotProcesses() {
    if (process.platform !== 'win32') return;

    const images = [
        'RiotClientServices.exe',
        'RiotClientUx.exe',
        'LeagueClient.exe',
        'LeagueClientUx.exe',
    ];

    for (const image of images) {
        try {
            // /T kills child processes as well.
            await execFileAsync('taskkill', ['/F', '/IM', image, '/T'], { windowsHide: true });
        } catch {
            // ignore if not running
        }
    }
}

function launchLeague({ riotClientPath, clientConfigUrl, patchline = 'live' } = {}) {
    if (process.platform !== 'win32') {
        return { success: false, error: 'Windows only' };
    }

    const resolvedPath = riotClientPath || findRiotClientServicesPath();
    if (!resolvedPath) {
        return { success: false, error: 'Riot Client not found. Set LTK_RIOT_CLIENT_PATH to RiotClientServices.exe.' };
    }

    const args = [];
    if (clientConfigUrl) {
        args.push(`--client-config-url=${clientConfigUrl}`);
    }

    args.push('--launch-product=league_of_legends', `--launch-patchline=${patchline}`);

    const child = spawn(resolvedPath, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
    });

    child.unref();
    return { success: true };
}

async function restartLeague({ riotClientPath, clientConfigUrl, patchline = 'live' } = {}) {
    await killRiotProcesses();
    return launchLeague({ riotClientPath, clientConfigUrl, patchline });
}

module.exports = {
    findRiotClientServicesPath,
    killRiotProcesses,
    launchLeague,
    restartLeague,
};

