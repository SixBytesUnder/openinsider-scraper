const { scrapeData } = require('./scraper');
const { getExistingData, prependData, initializeSheetHeaders } = require('./sheets');
const axios = require('axios');
require('dotenv').config();

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const ENABLE_DISCORD_NOTIFICATIONS = process.env.ENABLE_DISCORD_NOTIFICATIONS === 'true';

/**
 * Helper to log to console and optionally to Discord.
 * @param {string} message - The message to log.
 * @param {boolean} isError - If true, logs as error.
 */
async function log(message, isError = false) {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] ${message}`;

    if (isError) {
        console.error(formattedMessage);
    } else {
        console.log(formattedMessage);
    }

    if (ENABLE_DISCORD_NOTIFICATIONS && DISCORD_WEBHOOK_URL) {
        try {
            await axios.post(DISCORD_WEBHOOK_URL, {
                content: isError ? `🚨 **ERROR**: ${message}` : `ℹ️ ${message}`
            });
        } catch (err) {
            console.error('Failed to send Discord notification:', err.message);
        }
    }
}

async function main() {
    await log('[OpenInsider Scraper] Starting job...');

    try {
        // 1. Ensure headers exist
        await initializeSheetHeaders();

        // 2. Scrape Data
        const scrapedRows = await scrapeData();
        if (scrapedRows.length === 0) {
            await log('[OpenInsider Scraper] No data scraped.');
            return;
        }

        // 3. Get Existing Data (top chunk)
        // We only need enough to perform duplication checks. 
        // Since we insert at top, the latest data is at the top.
        const existingRows = await getExistingData(500); // Read top 500 rows

        // 4. Filter New Data
        // We need a unique key. 
        // row[0] = Filing Date, row[2] = Ticker, row[4] = Insider Name, row[6] = Trade Type
        // Note: existingRows comes as array of arrays (strings). scrapedRows is array of objects.
        
        const newRows = [];

        // Helper to generate key
        const generateKey = (r) => {
            // Unique key: FilingDate|Ticker|Insider|TradeType
            // precise enough and robust against number formatting changes
            if (Array.isArray(r)) {
                return `${r[0]}|${r[2]}|${r[4]}|${r[6]}`;
            }
            return `${r.filingDate}|${r.ticker}|${r.insiderName}|${r.tradeType}`;
        };

        const existingKeys = new Set(existingRows.map(generateKey));

        for (const row of scrapedRows) {
            const key = generateKey(row);
            if (!existingKeys.has(key)) {
                newRows.push(row);
            }
        }

        await log(`[OpenInsider Scraper] Found ${newRows.length} new rows.`);

        // 5. Update Sheet
        if (newRows.length > 0) {
            // Note: Scraped data comes "Latest Top" (Validation: OpenInsider sorts date desc).
            // But if we iterate standard loop, we push latest first.
            // If we Prepend, we want to maintain that order.
            // Example:
            // Scraped: [A (newest), B, C (oldest)]
            // Sheet: [D, E]
            // We want Sheet: [A, B, C, D, E]
            // our prepend function inserts at index 1.
            // If we insert [A, B, C] at index 1, it will look like Headers -> A, B, C -> D, E.
            // This preserves the order.
            await prependData(newRows);
            await log(`[OpenInsider Scraper] Successfully added ${newRows.length} rows to the sheet.`);
        } else {
            await log('[OpenInsider Scraper] No new data to add.');
        }

    } catch (error) {
        await log(`[OpenInsider Scraper] Job failed: ${error.message}`, true);
        process.exit(1);
    }
}

main();
