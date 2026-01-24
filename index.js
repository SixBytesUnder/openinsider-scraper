const { scrapeData } = require('./scraper');
const { getExistingData, prependData, initializeSheetHeaders } = require('./sheets');

async function main() {
    console.log(`[${new Date().toISOString()}] Starting job...`);

    try {
        // 1. Ensure headers exist
        await initializeSheetHeaders();

        // 2. Scrape Data
        const scrapedRows = await scrapeData();
        if (scrapedRows.length === 0) {
            console.log('No data scraped.');
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

        console.log(`Found ${newRows.length} new rows.`);

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
        } else {
            console.log('No new data to add.');
        }

    } catch (error) {
        console.error('Job failed:', error);
        process.exit(1);
    }
}

main();
