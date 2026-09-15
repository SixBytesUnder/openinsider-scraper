const axios = require('axios');
const cheerio = require('cheerio');
const { log } = require('./logger');

const TARGET_URL = 'http://openinsider.com/screener?s=&o=&pl=&ph=5&ll=&lh=&fd=180&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=25&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=1&cnt=100&page=1';

/**
 * Scrapes insider trading rows from OpenInsider.
 * @returns {Promise<Array<object>>} List of parsed row objects
 */
async function scrapeData() {
    try {
        await log(`[Scraper] Fetching data from ${TARGET_URL}...`, false, false);
        const { data } = await axios.get(TARGET_URL);
        const $ = cheerio.load(data);

        const rows = [];
        // The table has class 'tinytable'
        const table = $('table.tinytable tbody tr');

        table.each((index, element) => {
            const cells = $(element).find('td');
            if (cells.length === 0) return;

            // Extract data based on table column indices
            const rowData = {
                filingDate: $(cells[1]).text().trim(),
                tradeDate: $(cells[2]).text().trim(),
                ticker: $(cells[3]).text().trim(),
                companyName: $(cells[4]).text().trim(),
                insiderName: $(cells[5]).text().trim(),
                title: $(cells[6]).text().trim(),
                tradeType: $(cells[7]).text().trim(),
                price: $(cells[8]).text().trim().replace(/[$,]/g, ''),
                qty: $(cells[9]).text().trim().replace(/[+,]/g, ''),
                owned: $(cells[10]).text().trim().replace(/[+,]/g, ''),
                deltaOwn: $(cells[11]).text().trim(),
                value: $(cells[12]).text().trim().replace(/[+$,]/g, ''),
            };

            // Basic validation to ensure it's a valid data row
            if (rowData.ticker && rowData.filingDate) {
                rows.push(rowData);
            }
        });

        await log(`[Scraper] Scraped ${rows.length} rows.`, false, false);
        return rows;
    } catch (error) {
        await log(`[Scraper] Error scraping data: ${error.message}`, true);
        throw error;
    }
}

module.exports = { scrapeData };

