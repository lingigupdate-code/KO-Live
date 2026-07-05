const { IncomingForm } = require('formidable');
const fs = require('fs');
const { google } = require('googleapis'); // เพิ่มส่วนนี้

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = new IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.slip[0];
    const base64File = fs.readFileSync(file.filepath).toString('base64');
    
    // --- ส่วนของ Google Sheets API ---
    try {
      // โหลด Credential จาก Environment Variable
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      const sheets = google.sheets({ version: 'v4', auth });
      
      // บันทึกลง Sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA',
        range: 'Data!A:E', // ระบุแท็บ Data และช่วงคอลัมน์
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[
            new Date().toLocaleString('th-TH'), 
            fields.xUsername[0], 
            fields.rooms[0], 
            fields.price[0], 
            "บันทึกผ่าน API"
          ]]
        }
      });

      res.status(200).json({ status: "success", message: "บันทึกข้อมูลเรียบร้อย" });
    } catch (error) {
      console.error("API Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}