const { IncomingForm } = require('formidable');
const fs = require('fs');
const { google } = require('googleapis');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = new IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.slip[0];
    const base64File = fs.readFileSync(file.filepath).toString('base64');

    try {
      // --- ส่วนที่ 1: ส่งรูปไป Google Apps Script เพื่อขึ้น Drive ---
      const gasResponse = await fetch('https://script.google.com/macros/s/AKfycbxoqoDb25Uuom2tZUpo_2Q2BkiurFUI-wyIhNXW21bhBgQp-6J4fH6eqvmC9F0dUYFC/exec', {
        method: 'POST',
        body: JSON.stringify({
          fileData: base64File,
          mimeType: file.mimetype,
          fileName: file.originalFilename
        })
      });
      const gasResult = await gasResponse.json(); // สมมติว่าคืนค่า { url: "..." }

      // --- ส่วนที่ 2: ใช้บอท (Service Account) บันทึกลง Sheets ---
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA',
        range: 'Data!A:E',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[new Date().toLocaleString('th-TH'), fields.xUsername[0], fields.rooms[0], fields.price[0], gasResult.url]]
        }
      });

      res.status(200).json({ status: "success", url: gasResult.url });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}