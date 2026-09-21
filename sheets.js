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
 * Strips currency symbols ($), plus signs (+), and formatting commas (,)
 * from numerical strings while preserving negative signs (-) and decimals.
 * @param {string|number} val
 * @returns {string}
 */
function cleanNumber(val) {
    if (val === null || val === undefined) return '';
    return String(val).replace(/[+$,]/g, '').trim();
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
            cleanNumber(row.price),
            cleanNumber(row.qty),
            cleanNumber(row.owned),
            typeof row.deltaOwn === 'string' ? row.deltaOwn.replace(/^\+/, '') : row.deltaOwn,
            cleanNumber(row.value)
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
 * Scans existing rows in the sheet and repairs any corrupted numerical values
 * (e.g. values containing '$', leading '+', or formulas causing '#ERROR!').
 * @returns {Promise<number>} Number of repaired rows
 */
async function cleanExistingSheetData() {
    try {
        const { sheets, spreadsheetId, sheetName } = getSheetsContext();
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A2:L`,
            valueRenderOption: 'FORMULA'
        });

        const rows = response.data.values || [];
        if (rows.length === 0) return 0;

        let repairedCount = 0;
        const dataToUpdate = [];

        rows.forEach((r, idx) => {
            const origPrice = r[7];
            const origQty = r[8];
            const origOwned = r[9];
            const origDeltaOwn = r[10];
            const origValue = r[11];

            const cleanPrice = cleanNumber(origPrice);
            const cleanQty = cleanNumber(origQty);
            const cleanOwned = cleanNumber(origOwned);
            const cleanDeltaOwn = typeof origDeltaOwn === 'string' ? origDeltaOwn.replace(/^\+/, '') : origDeltaOwn;
            const cleanVal = cleanNumber(origValue);

            if (
                String(origPrice ?? '') !== cleanPrice ||
                String(origQty ?? '') !== cleanQty ||
                String(origOwned ?? '') !== cleanOwned ||
                origDeltaOwn !== cleanDeltaOwn ||
                String(origValue ?? '') !== cleanVal
            ) {
                repairedCount++;
                const rowIndex = idx + 2;
                dataToUpdate.push({
                    range: `${sheetName}!H${rowIndex}:L${rowIndex}`,
                    values: [[cleanPrice, cleanQty, cleanOwned, cleanDeltaOwn, cleanVal]]
                });
            }
        });

        if (dataToUpdate.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                resource: {
                    valueInputOption: 'USER_ENTERED',
                    data: dataToUpdate
                }
            });
            await log(`[Google Sheets] Cleaned up ${repairedCount} corrupted rows in ${sheetName}.`);
        } else {
            await log(`[Google Sheets] All rows in ${sheetName} are already clean.`);
        }

        return repairedCount;
    } catch (error) {
        await log(`[Google Sheets] Error cleaning existing sheet data: ${error.message}`, true);
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

module.exports = { getExistingData, prependData, initializeSheetHeaders, cleanExistingSheetData, cleanNumber };

