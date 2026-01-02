const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Log Service - Sistema de Logs Profissional
 * - Logs em tempo real para UI
 * - Gravação em arquivo
 * - Filtros por módulo e nível
 * - Rotação de logs
 * - Exportação
 */
class LogService extends EventEmitter {
    constructor() {
        super();
        
        this.logs = [];
        this.maxLogsInMemory = 1000;
        this.logDir = path.join(app.getPath('userData'), 'logs');
        this.currentLogFile = path.join(this.logDir, `ltk-${this.getDateString()}.log`);
        
        // Módulos permitidos
        this.modules = [
            'LCU',
            'AutoAccept',
            'AutoPick',
            'AutoBan',
            'Chat',
            'Profile',
            'Match',
            'Stats',
            'System',
            'Feature'
        ];

        // Níveis de log
        this.levels = ['info', 'success', 'warning', 'error', 'debug'];

        this.initLogDirectory();
        this.log('System', 'info', 'Log service initialized');
    }

    /**
     * Inicializar diretório de logs
     */
    initLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }

        // Limpar logs antigos (mais de 7 dias)
        this.cleanOldLogs();
    }

    /**
     * Adicionar log
     */
    log(module, level, message, details = '') {
        if (!this.modules.includes(module)) {
            console.warn(`[LogService] Unknown module: ${module}`);
            module = 'System';
        }

        if (!this.levels.includes(level)) {
            console.warn(`[LogService] Unknown level: ${level}`);
            level = 'info';
        }

        const timestamp = new Date().toISOString();
        const displayTime = new Date().toLocaleTimeString('en-US', { hour12: false });
        
        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp,
            displayTime,
            module,
            level,
            message,
            details
        };

        // Adicionar à memória
        this.logs.unshift(logEntry);
        
        // Limitar tamanho
        if (this.logs.length > this.maxLogsInMemory) {
            this.logs = this.logs.slice(0, this.maxLogsInMemory);
        }

        // Console output com cores
        this.logToConsole(logEntry);

        // Gravar em arquivo
        this.writeToFile(logEntry);

        // Emitir para renderer
        this.emit('log', logEntry);
    }

    /**
     * Log com cores no console
     */
    logToConsole(logEntry) {
        const colors = {
            info: '\x1b[36m',      // Cyan
            success: '\x1b[32m',   // Green
            warning: '\x1b[33m',   // Yellow
            error: '\x1b[31m',     // Red
            debug: '\x1b[35m',     // Magenta
            reset: '\x1b[0m'
        };

        const color = colors[logEntry.level] || colors.reset;
        const levelStr = logEntry.level.toUpperCase().padEnd(7);
        const moduleStr = logEntry.module.padEnd(12);

        console.log(
            `${color}[${logEntry.displayTime}][${moduleStr}][${levelStr}]${colors.reset} ${logEntry.message} ${logEntry.details}`
        );
    }

    /**
     * Gravar em arquivo
     */
    writeToFile(logEntry) {
        const line = `[${logEntry.timestamp}][${logEntry.module}][${logEntry.level.toUpperCase()}] ${logEntry.message} ${logEntry.details}\n`;
        
        fs.appendFile(this.currentLogFile, line, (err) => {
            if (err) {
                console.error('[LogService] Failed to write log:', err);
            }
        });
    }

    /**
     * Obter logs com filtros
     */
    getLogs(filter = null) {
        if (!filter) return this.logs;

        return this.logs.filter(log => {
            if (filter.module && log.module !== filter.module) return false;
            if (filter.level && log.level !== filter.level) return false;
            if (filter.search) {
                const searchLower = filter.search.toLowerCase();
                const matchMessage = log.message.toLowerCase().includes(searchLower);
                const matchDetails = log.details.toLowerCase().includes(searchLower);
                if (!matchMessage && !matchDetails) return false;
            }
            return true;
        });
    }

    /**
     * Limpar logs da memória
     */
    clearLogs() {
        this.logs = [];
        this.log('System', 'info', 'Logs cleared from memory');
    }

    /**
     * Limpar arquivo de log atual
     */
    clearLogFile() {
        fs.writeFile(this.currentLogFile, '', (err) => {
            if (err) {
                console.error('[LogService] Failed to clear log file:', err);
            } else {
                this.log('System', 'info', 'Log file cleared');
            }
        });
    }

    /**
     * Limpar logs antigos
     */
    cleanOldLogs() {
        try {
            const files = fs.readdirSync(this.logDir);
            const now = Date.now();
            const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias

            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log(`[LogService] Deleted old log: ${file}`);
                }
            });
        } catch (error) {
            console.error('[LogService] Failed to clean old logs:', error);
        }
    }

    /**
     * Exportar logs
     */
    async exportLogs(outputPath) {
        try {
            const logsText = this.logs.map(log => 
                `[${log.timestamp}][${log.module}][${log.level.toUpperCase()}] ${log.message} ${log.details}`
            ).join('\n');

            fs.writeFileSync(outputPath, logsText, 'utf8');
            this.log('System', 'success', `Logs exported to ${outputPath}`);
            return { success: true, path: outputPath };
        } catch (error) {
            this.log('System', 'error', 'Failed to export logs', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obter estatísticas de logs
     */
    getStats() {
        const stats = {
            total: this.logs.length,
            byLevel: {},
            byModule: {}
        };

        this.logs.forEach(log => {
            // Por nível
            stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
            
            // Por módulo
            stats.byModule[log.module] = (stats.byModule[log.module] || 0) + 1;
        });

        return stats;
    }

    /**
     * Obter string de data para arquivo
     */
    getDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Aliases para conveniência
     */
    info(module, message, details = '') {
        this.log(module, 'info', message, details);
    }

    success(module, message, details = '') {
        this.log(module, 'success', message, details);
    }

    warning(module, message, details = '') {
        this.log(module, 'warning', message, details);
    }

    error(module, message, details = '') {
        this.log(module, 'error', message, details);
    }

    debug(module, message, details = '') {
        this.log(module, 'debug', message, details);
    }
}

module.exports = LogService;