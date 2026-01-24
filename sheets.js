const { google } = require('googleapis');
require('dotenv').config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Auth client
const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

async function getExistingData(limit = 200) {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!A2:L${limit + 1}`, // Assuming headers are in row 1
        });
        return response.data.values || [];
    } catch (error) {
        console.error('Error reading from Sheets:', error);
        // If the sheet is empty or doesn't exist, return empty array
        return [];
    }
}

async function prependData(newRows) {
    if (newRows.length === 0) return;

    // We need to insert these rows at the top (after header).
    // Strategy: 
    // 1. Insert blank rows at index 1 (meaning row 2).
    // 2. Update those rows with data.
    
    // However, spreadsheets.values.append adds to the bottom.
    // To 'prepend', we must physically move existing cells or insert dimension.
    // Ideally:
    // 1. Insert N empty rows at index 1.
    // 2. Write data to these N rows.

    try {
        // 1. Insert empty rows
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [
                    {
                        insertDimension: {
                            range: {
                                sheetId: 0, // Assuming first sheet
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

        // 2. Write data
        // Convert objects to arrays matching column order
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
            spreadsheetId: SPREADSHEET_ID,
            range: `Sheet1!A2`,
            valueInputOption: 'USER_ENTERED',
            resource: { values }
        });

        console.log(`Successfully prepended ${newRows.length} rows.`);

    } catch (error) {
        console.error('Error updating sheet:', error);
        throw error;
    }
}

async function initializeSheetHeaders() {
     // Check if headers exist, if not add them
     try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A1:L1'
        });
        
        if (!response.data.values || response.data.values.length === 0) {
            console.log("Headers missing, adding them...");
            const headers = [
                "Filing Date", "Trade Date", "Ticker", "Company Name", 
                "Insider Name", "Title", "Trade Type", "Price", 
                "Qty", "Owned", "Delta Own", "Value"
            ];
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Sheet1!A1',
                valueInputOption: 'USER_ENTERED',
                resource: { values: [headers] }
            });
        }
     } catch (error) {
         console.error("Error initializing headers:", error);
     }
}

module.exports = { getExistingData, prependData, initializeSheetHeaders };
