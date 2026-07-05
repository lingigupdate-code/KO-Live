const { IncomingForm } = require('formidable');
const fs = require('fs');
const { google } = require('googleapis');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = new IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.slip[0];
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file' // เพิ่มสิทธิ์ Drive
      ],
    });

    try {
      // 1. อัปโหลดรูปขึ้น Google Drive
      const drive = google.drive({ version: 'v3', auth });
      const fileMetadata = {
        name: file.originalFilename,
        parents: ['15_LEt64HOd3oSINx3q3Dk4nhDJbnFe9J'] // ใส่ Folder ID ของคุณที่นี่
      };
      const media = {
        mimeType: file.mimetype,
        body: fs.createReadStream(file.filepath),
      };
      const driveRes = await drive.files.create({ requestBody: fileMetadata, media: media });
      const fileUrl = `https://drive.google.com/open?id=${driveRes.data.id}`;

      // 2. บันทึกลง Google Sheets
      const sheets = google.sheets({ version: 'v4', auth });
      await sheets.spreadsheets.values.append({
        spreadsheetId: '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA',
        range: 'Data!A:E',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[new Date().toLocaleString('th-TH'), fields.xUsername[0], fields.rooms[0], fields.price[0], fileUrl]]
        }
      });

      res.status(200).json({ status: "success", url: fileUrl });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}