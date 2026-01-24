# OpenInsider Scraper

This Node.js application scrapes insider trading data from [OpenInsider.com](http://openinsider.com) and synchronizes it with a Google Sheet. It is designed to run periodically (e.g., via cron) to keep a spreadsheet updated with the latest insider trades.

## Features

- **Automated Scraping**: Fetches the latest insider trading data.
- **Deduplication**: Checks existing data in the Google Sheet to prevent duplicate entries.
- **Smart Updates**: Prepends new data to the top of the sheet, ensuring the most recent trades are always visible first.
- **Auto-Initialization**: Automatically creates column headers if the sheet is empty.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher recommended)
- A Google Cloud Platform project with the **Google Sheets API** enabled.
- A Service Account with access to the target Google Sheet.

## Installation

1.  Clone the repository:

    ```bash
    git clone <repository-url>
    cd openinsider-scraper
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

## Configuration

1.  **Google Service Account**:
    - Create a Service Account in your Google Cloud Console.
    - Download the JSON key file.
    - Place the JSON key file in the project root (e.g., named `service_account.json`).

2.  **Google Sheet**:
    - Create a new Google Sheet.
    - Share the sheet with the email address of your Service Account (found in the JSON key file).
    - Note the **Spreadsheet ID** from the URL (e.g., `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID/edit`).

3.  **Environment Variables**:
    - Create a `.env` file in the project root:
    ```bash
    touch .env
    ```

    - Add the following variables:
    ```env
    SPREADSHEET_ID=your_spreadsheet_id_here
    GOOGLE_APPLICATION_CREDENTIALS=./service_account.json
    ```

## Usage

Run the scraper manually:

```bash
node index.js
```

### Scheduled Execution

To run this script automatically (e.g., every hour), you can use `cron` on Linux/macOS or Task Scheduler on Windows.

**Example Crontab (runs every hour):**

```bash
0 * * * * /usr/bin/node /path/to/openinsider-scraper/index.js >> /path/to/openinsider-scraper/logfile.log 2>&1
```

## Project Structure

- `index.js`: Main entry point. Orchestrates scraping, deduplication, and updating.
- `scraper.js`: Handles fetching and parsing data from OpenInsider.
- `sheets.js`: Manages Google Sheets API interactions (read, write, prepend).
- `package.json`: Project dependencies and scripts.

## Dependencies

- `axios`: HTTP client for fetching web pages.
- `cheerio`: jQuery implementation for parsing HTML.
- `googleapis`: Official Google APIs client.
- `dotenv`: Loads environment variables.
