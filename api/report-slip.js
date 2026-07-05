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

      // 2. เตรียมข้อมูลสำหรับ Google Sheets API
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ดึงรายชื่อห้องที่ส่งมา เช่น "ภูเก็ต, เชียงใหม่, เกิร์ลคัพ" มาหั่นแยกเป็นอาเรย์
  const roomsString = fields.rooms[0]; 
  const roomsArray = roomsString.split(',').map(r => r.trim()); // ผลลัพธ์: ['ภูเก็ต', 'เชียงใหม่', 'เกิร์ลคัพ']

  // แปลงข้อมูลให้อยู่ในรูปแบบหลายแถว (Multi-rows) เพื่อบันทึกลง Sheet แยกกัน
  const valuesToAppend = roomsArray.map(room => [
    new Date().toLocaleString('th-TH'), 
    fields.xUsername[0], 
    room,              // แยกชื่อห้องเดี่ยวๆ ลงคอลัมน์ C ตรงนี้แล้ว!
    fields.price[0],   // ยอดเงินรวม
    "-",               // คอลัมน์ E (เว้นว่างไว้ชั่วคราว)
    ""                 // คอลัมน์ F (เว้นไว้ให้สูตรใน Sheet คำนวณเอง)
  ]);

  // สั่งบันทึกข้อมูลทุกห้องลง Sheet พร้อมกัน (จะเพิ่มแถวตามจำนวนห้องที่ซื้อจริง)
  const appendResult = await sheets.spreadsheets.values.append({
    spreadsheetId: '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA',
    range: 'Data!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: valuesToAppend
    }
  });

  // --- 🌟 ทีเด็ด: ดึงชื่อที่สูตรใน Sheet (คอลัมน์ F) เพิ่งคำนวณเสร็จกลับมาแสดงบนเว็บ ---
  const updatedRange = appendResult.data.updates.updatedRange; // เช่น "Data!A3:E5"
  // เปลี่ยนพิกัดช่วงเพื่อวิ่งไปอ่านที่ คอลัมน์ F ของแถวนั้นๆ
  const rangeForNames = updatedRange.replace(/A/g, 'F').replace(/E/g, 'F'); 

  const namesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA',
    range: rangeForNames,
  });

  const fetchedNames = namesResponse.data.values; // จะได้ค่า [['ภูเก็ต-1'], ['เชียงใหม่-1']]
  
  // ยุบรวมชื่อกลับเป็น Object เพื่อส่งกลับไปให้หน้าบ้าน render ปุ่มคัดลอก
  const generatedNames = {};
  roomsArray.forEach((room, index) => {
    generatedNames[room] = fetchedNames && fetchedNames[index] ? fetchedNames[index][0] : `${room}-1`;
  });

  // ส่งผลลัพธ์กลับไปให้หน้าบ้านใช้
  res.status(200).json({ status: "success", generatedNames: generatedNames });

} catch (error) {
  res.status(500).json({ error: error.message });
}