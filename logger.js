const axios = require('axios');

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ENABLE_DISCORD_NOTIFICATIONS = process.env.ENABLE_DISCORD_NOTIFICATIONS === 'true';

/**
 * Format and print timestamped log messages, and optionally dispatch to Discord.
 * @param {string} message - Message to log
 * @param {boolean} [isError=false] - Whether this is an error message
 * @param {boolean} [notifyDiscord=true] - Whether to send this log message to Discord if enabled
 */
async function log(message, isError = false, notifyDiscord = true) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;

    if (isError) {
        console.error(formattedMessage);
    } else {
        console.log(formattedMessage);
    }

    if (notifyDiscord && ENABLE_DISCORD_NOTIFICATIONS && DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                content: isError ? `🚨 **ERROR**: ${message}` : `ℹ️ ${message}`
            });
        } catch (err) {
            console.error(`[${timestamp}] Failed to send Discord notification:`, err.message);
        }
    }
}

/**
 * Send custom content to Discord with delay between multiple chunks if necessary.
 * @param {string} content - Markdown/text content to send
 */
async function sendDiscordNotification(content) {
    if (!ENABLE_DISCORD_NOTIFICATIONS || !DISCORD_WEBHOOK_URL) return;

    // Discord message character limit is 2000; split into <= 1900 char chunks
    const chunks = content.match(/[\s\S]{1,1900}/g) || [];
    for (let i = 0; i < chunks.length; i++) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, { content: chunks[i] });
            // Add a small delay between consecutive chunks to avoid Discord rate limiting (429)
            if (i < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 350));
            }
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Failed to send Discord message chunk ${i + 1}/${chunks.length}:`, err.message);
        }
    }
}

module.exports = {
    log,
    sendDiscordNotification
};
