const axios = require('axios');
const cheerio = require('cheerio');

const TARGET_URL = 'http://openinsider.com/screener?s=&o=&pl=&ph=5&ll=&lh=&fd=180&fdr=&td=0&tdr=&fdlyl=&fdlyh=&daysago=&xp=1&xs=1&vl=25&vh=&ocl=&och=&sic1=-1&sicl=100&sich=9999&grp=0&nfl=&nfh=&nil=&nih=&nol=&noh=&v2l=&v2h=&oc2l=&oc2h=&sortcol=1&cnt=100&page=1';

async function scrapeData() {
    try {
        console.log(`Fetching data from ${TARGET_URL}...`);
        const { data } = await axios.get(TARGET_URL);
        const $ = cheerio.load(data);

        const rows = [];
        // The table has class 'tinytable'
        const table = $('table.tinytable tbody tr');

        table.each((index, element) => {
            const cells = $(element).find('td');
            if (cells.length === 0) return;

            // Extract data based on the indices we identified
            // 0: X (ignore)
            // 1: Filing Date
            // 2: Trade Date
            // 3: Ticker
            // 4: Company Name
            // 5: Insider Name
            // 6: Title
            // 7: Trade Type
            // 8: Price
            // 9: Qty
            // 10: Owned
            // 11: Delta Own
            // 12: Value

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
            
            // Basic validation to ensure it's a data row
            if (rowData.ticker && rowData.filingDate) {
                rows.push(rowData);
            }
        });

        console.log(`Scraped ${rows.length} rows.`);
        return rows;
    } catch (error) {
        console.error('Error scraping data:', error);
        throw error;
    }
}

module.exports = { scrapeData };
