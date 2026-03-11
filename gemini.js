const axios = require('axios');

async function analyzeWithGemini(allRows) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
        console.error("No Gemini API key found.");
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

    // Gemini 2.5 Flash has a large context window, but to be extremely safe against Axios payload limits
    // or very slow API responses, we can enforce a generous character limit (e.g. 2 million characters).
    if (dataString.length > 2000000) {
        console.log("Data string exceeds 2M characters, truncating the older rows to fit prompt limits.");
        // roughly slice to ensure it fits
        const safeRows = formattedData.slice(0, 15000);
        dataString = JSON.stringify(safeRows);
    }

    const prompt = `Analyze the following historical and recent insider trading data provided in JSON format. Based on purchases and sales of stocks (Trade Type: P for Purchase, S for Sale), and considering the logic that stock prices often increase after an insider purchase and drop after an insider sale, provide an analysis. Find interesting patterns or anomalies in the whole dataset, and suggest which stocks I should buy or sell.

Keep your response concise, actionable, and formatted for Discord (you can use bolding, bullet points, and basic markdown, but avoid complex markdown that might not render well or long paragraphs). Limit your response to 1500 characters so it fits nicely in a single Discord message.

Data:
${dataString}`;

    try {
        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
                    'Content-Type': 'application/json'
                }
            }
        );

        if (response.data && response.data.candidates && response.data.candidates.length > 0) {
            let aiResponse = response.data.candidates[0].content.parts[0].text;
            return aiResponse;
        } else {
            console.error("Unexpected response from Gemini API:", response.data);
            return null;
        }
    } catch (error) {
        console.error("Error analyzing with Gemini:", error.response?.data || error.message);
        return null;
    }
}

module.exports = { analyzeWithGemini };
