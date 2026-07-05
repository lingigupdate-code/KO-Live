const { IncomingForm } = require('formidable');
const fs = require('fs');
const { google } = require('googleapis');

export const config = { api: { bodyParser: false } };

// 🌟 เพิ่มฟังก์ชันช่วยหน่วงเวลา (Delay) สำหรับรอให้ Google Sheets คำนวณสูตร ArrayFormula เสร็จชัวร์ๆ
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
      const gasResult = await gasResponse.json(); 
      const fileUrl = gasResult.url || "-"; 

      // --- ส่วนที่ 2: เตรียมข้อมูลสำหรับ Google Sheets API ---
      const auth = new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      const spreadsheetId = '1YSkEk2G9IyKQu0wELH1CjW6gtw83zBMyvC9_guJG4RA';

      // ดึงรายชื่อห้องที่ส่งมา เช่น "ภูเก็ต, เชียงใหม่" มาแยกเป็นอาเรย์
      const roomsString = fields.rooms[0]; 
      const roomsArray = roomsString.split(',').map(r => r.trim()); 

      // 🌟 แก้ไขจุดที่ 1: ปรับเวลาให้เป็น "เวลาประเทศไทย" (GMT+7) เสมอ
      const thailandDateTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

      // แปลงข้อมูลให้อยู่ในรูปแบบหลายแถว
      const valuesToAppend = roomsArray.map(room => [
        thailandDateTime,    // คอลัมน์ A (เวลาไทย)
        fields.xUsername[0], // คอลัมน์ B
        room,                // คอลัมน์ C
        fields.price[0],     // คอลัมน์ D
        fileUrl,             // คอลัมน์ E
        ""                   // คอลัมน์ F (เว้นว่างไว้ให้ ArrayFormula ใน Sheet คำนวณเอง)
      ]);

      // 🌟 แก้ไขจุดที่ 2: เปลี่ยนช่วงข้อมูลเป็น Data!A1 บังคับให้เริ่มเขียนจากมุมซ้ายบน ข้อมูลจะได้ไม่กระโดด
      const appendResult = await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
        range: 'Data!A1', 
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: valuesToAppend
        }
      });

      // แยกชื่อแท็บกับพิกัดออกจากกันแบบปลอดภัยด้วยเครื่องหมาย !
      const updatedRange = appendResult.data.updates.updatedRange; 
      const [sheetPart, rangePart] = updatedRange.split('!');
      const rows = rangePart.match(/\d+/g); 
      const rangeForNames = `${sheetPart}!F${rows[0]}:F${rows[1] || rows[0]}`; 

      // ⏳ แก้ไขจุดที่ 3: สั่งหน่วงเวลา 1.5 วินาที เพื่อรอให้ Sheet ประมวลผลสูตรคอลัมน์ F ให้เสร็จก่อน
      await delay(1500);

      // วิ่งไปอ่านค่าชื่อที่สูตรคอลัมน์ F เจนออกมาหลังจากหน่วงเวลาเสร็จแล้ว
      const namesResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: rangeForNames,
      });

      const fetchedNames = namesResponse.data.values; 
      
      // ยุบรวมชื่อกลับเป็น Object เพื่อส่งกลับไปให้หน้าบ้านใช้งาน
      const generatedNames = {};
      roomsArray.forEach((room, index) => {
        generatedNames[room] = fetchedNames && fetchedNames[index] ? fetchedNames[index][0] : `${room}-1`;
      });

      // ส่งผลลัพธ์กลับไปให้หน้าบ้านใช้
      res.status(200).json({ status: "success", generatedNames: generatedNames });

    } catch (error) {
      console.error("Backend Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}