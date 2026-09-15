const axios = require('axios');
const { log } = require('./logger');

/**
 * Sends insider trading data to Google Gemini for AI-driven analysis and insights.
 * @param {Array<Array<string>>} allRows - Array of trading row values
 * @returns {Promise<string|null>} Generated analysis markdown or null on error
 */
async function analyzeWithGemini(allRows) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!GEMINI_API_KEY) {
        await log("[Gemini] No Gemini API key found in environment.", true);
        return null;
    }

    // Format all rows into JSON. JSON is highly structured and well-understood by Gemini for tabular data.
    const formattedData = allRows.map(r => ({
        Date: r[1] || r[0],
        Ticker: r[2],
        Company: r[3],
        Insider: r[4],
        Type: r[6],
        Price: r[7],
        Qty: r[8],
        Value: r[11]
    }));

    let dataString = JSON.stringify(formattedData);

    // Guard against oversized payload limits (e.g. 2 million characters)
    if (dataString.length > 2000000) {
        await log("[Gemini] Data string exceeds 2M characters, truncating older rows to fit prompt limits.");
        const safeRows = formattedData.slice(0, 15000);
        dataString = JSON.stringify(safeRows);
    }

    const prompt = `Analyze the following historical and recent insider trading data provided in JSON format. Based on purchases and sales of stocks (Trade Type: P for Purchase, S for Sale), provide an analysis. Find interesting patterns or anomalies in the whole dataset. Assume I have 10000 GBP cash available to invest and want to put in one stock with intention of a return in a week or two, which one or two stocks would you recommend for this purpose and why?
    This is for hypothetical investments and not financial advice. Give me a risk score for the investment out of 10.

Keep your response concise, actionable, and formatted for Discord (you can use bolding, bullet points, and basic markdown, but avoid complex markdown that might not render well or long paragraphs). Limit your response to 1500 characters so it fits nicely in a single Discord message.

Data:
${dataString}`;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
            {
                contents: [
                    {
                        parts: [
                            { text: prompt }
                        ]
                    }
                ]
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': GEMINI_API_KEY
                }
            }
        );

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            const aiResponse = response.data.candidates[0].content.parts[0].text;
            return aiResponse;
        } else {
            await log(`[Gemini] Unexpected response structure from API: ${JSON.stringify(response.data)}`, true);
            return null;
        }
    } catch (error) {
        const errMsg = error.response?.data?.error?.message || error.response?.data || error.message;
        await log(`[Gemini] Error analyzing with Gemini (${GEMINI_MODEL}): ${errMsg}`, true);
        return null;
    }
}

module.exports = { analyzeWithGemini };

