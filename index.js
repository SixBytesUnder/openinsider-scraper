const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { log, sendDiscordNotification } = require('./logger');
const { scrapeData } = require('./scraper');
const { getExistingData, prependData, initializeSheetHeaders } = require('./sheets');
const { analyzeWithGemini } = require('./gemini');

/**
 * Generates a unique deduplication key for an insider trade record.
 * @param {object|Array<string>} r - Scraped row object or sheet row array
 * @returns {string} Unique composite key
 */
function generateKey(r) {
    // Unique key: FilingDate|Ticker|Insider|TradeType
    // Robust against formatting changes
    if (Array.isArray(r)) {
        return `${r[0]}|${r[2]}|${r[4]}|${r[6]}`;
    }
    return `${r.filingDate}|${r.ticker}|${r.insiderName}|${r.tradeType}`;
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

        // 3. Read all rows to use for analysis later, and for duplication checks
        const existingRows = await getExistingData(null);

        // 4. Filter New Data
        const newRows = [];
        const existingKeys = new Set(existingRows.map(generateKey));

        for (const row of scrapedRows) {
            const key = generateKey(row);
            if (!existingKeys.has(key)) {
                newRows.push(row);
            }
        }

        await log(`[OpenInsider Scraper] Found ${newRows.length} new rows.`);

        // 5. Update Sheet & Run Analysis if new data exists
        if (newRows.length > 0) {
            await prependData(newRows);
            await log(`[OpenInsider Scraper] Successfully added ${newRows.length} rows to the sheet.`);

            await log(`[OpenInsider Scraper] Analyzing all data with Gemini...`);
            // Combine new rows and existing rows into a single array format
            const updatedRows = [
                ...newRows.map(row => [
                    row.filingDate, row.tradeDate, row.ticker, row.companyName,
                    row.insiderName, row.title, row.tradeType, row.price,
                    row.qty, row.owned, row.deltaOwn, row.value
                ]),
                ...existingRows
            ];

            const analysis = await analyzeWithGemini(updatedRows);
            if (analysis) {
                await log(`[OpenInsider Scraper] Gemini Analysis complete. Sending to Discord.`);
                await sendDiscordNotification(`🧠 **Gemini Analysis:**\n${analysis}`);
            }
        } else {
            await log('[OpenInsider Scraper] No new data to add.');
        }

    } catch (error) {
        await log(`[OpenInsider Scraper] Job failed: ${error.message}`, true);
        process.exit(1);
    }
}

main();

