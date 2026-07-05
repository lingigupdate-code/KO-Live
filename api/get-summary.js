// api/get-summary.js
const { google } = require('googleapis');

export default async function handler(req, res) {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  
  // ดึงข้อมูลที่สรุปไว้จากสูตร COUNTIF ในแท็บ Summary
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA',
    range: 'Summary!A:B', 
  });
  
  res.status(200).json(response.data.values);
}