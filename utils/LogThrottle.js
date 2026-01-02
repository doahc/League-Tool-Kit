// src/utils/LogThrottle.js
class LogThrottle {
    constructor(delay = 5000) {
        this.delay = delay;
        this.lastLog = {};
    }

    log(context, level, message, details = '') {
        const key = `${context}-${level}-${message}`;
        const now = Date.now();

        if (!this.lastLog[key] || (now - this.lastLog[key] > this.delay)) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}][${context}][${level}] ${message} ${details}`);
            this.lastLog[key] = now;
        }
    }
    
    clear() {
        this.lastLog = {};
    }
}

module.exports = LogThrottle;