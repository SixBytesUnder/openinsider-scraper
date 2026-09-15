const { google } = require('googleapis');
const { log } = require('./logger');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * Lazily obtains an authenticated Google Sheets API client and spreadsheet configuration.
 * @returns {{ sheets: google.sheets_v4.Sheets, spreadsheetId: string, sheetGridId: number, sheetName: string }}
 */
function getSheetsContext() {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheetGridId = parseInt(process.env.SHEET_GRID_ID || '0', 10);
    const sheetName = process.env.SHEET_NAME || 'Sheet1';
    const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: SCOPES,
    });

    const sheets = google.sheets({ version: 'v4', auth });
    return { sheets, spreadsheetId, sheetGridId, sheetName };
}

/**
 * Retrieves existing data from the Google Sheet.
 * @param {number|null} [limit=200] - Row limit or null for all rows
 * @returns {Promise<Array<Array<string>>>} Array of row data
 */
async function getExistingData(limit = 200) {
    try {
        const { sheets, spreadsheetId, sheetName } = getSheetsContext();
        const range = limit ? `${sheetName}!A2:L${limit + 1}` : `${sheetName}!A2:L`;
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return response.data.values || [];
    } catch (error) {
        await log(`[Google Sheets] Error reading from Sheets: ${error.message}`, true);
        return [];
    }
}

/**
 * Inserts new rows at the top of the Google Sheet (after headers).
 * @param {Array<object>} newRows - Array of scraped row objects to insert
 */
async function prependData(newRows) {
    if (newRows.length === 0) return;

    try {
        const { sheets, spreadsheetId, sheetGridId, sheetName } = getSheetsContext();

        // 1. Insert empty rows at row index 1 (directly beneath header row)
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: sheetGridId,
                                dimension: "ROWS",
                                startIndex: 1,
                                endIndex: 1 + newRows.length
                            },
                            inheritFromBefore: false
                        }
                    }
                ]
            }
        });

        // 2. Write data to the inserted rows
        const values = newRows.map(row => [
            row.filingDate,
            row.tradeDate,
            row.ticker,
            row.companyName,
            row.insiderName,
            row.title,
            row.tradeType,
            row.price,
            row.qty,
            row.owned,
            row.deltaOwn,
            row.value
        ]);

        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A2`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });

        await log(`[Google Sheets] Successfully prepended ${newRows.length} rows to ${sheetName}.`);
    } catch (error) {
        await log(`[Google Sheets] Error updating sheet: ${error.message}`, true);
        throw error;
    }
}

/**
 * Checks if the header row exists on the sheet and creates standard headers if missing.
 */
async function initializeSheetHeaders() {
    try {
        const { sheets, spreadsheetId, sheetName } = getSheetsContext();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A1:L1`
        });

        if (!response.data.values || response.data.values.length === 0) {
            await log(`[Google Sheets] Headers missing on ${sheetName}, initializing headers...`);
            const headers = [
                "Filing Date", "Trade Date", "Ticker", "Company Name",
                "Insider Name", "Title", "Trade Type", "Price",
                "Qty", "Owned", "Delta Own", "Value"
            ];
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [headers] }
            });
        }
    } catch (error) {
        await log(`[Google Sheets] Error initializing headers: ${error.message}`, true);
    }
}

module.exports = { getExistingData, prependData, initializeSheetHeaders };

