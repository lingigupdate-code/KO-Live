const { IncomingForm } = require('formidable');
const fs = require('fs');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = new IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: err.message });

    const file = files.slip[0]; // ดึงไฟล์ตัวแรก
    const base64File = fs.readFileSync(file.filepath).toString('base64');

    try {
      const response = await fetch('https://script.google.com/macros/s/AKfycbyt-_7TfMe1PnLmqp3MV3G30JoXQzTz2LuvfJ8vXeK3019JwEXuJRqFEMzwJLSW0LY/exec', {
        method: 'POST',
        body: JSON.stringify({
          fileData: base64File,
          mimeType: file.mimetype,
          fileName: file.originalFilename,
          xUsername: fields.xUsername[0],
          rooms: fields.rooms[0],
          price: fields.price[0]
        })
      });

      // อ่านผลลัพธ์เป็น text ก่อน เพื่อดูว่าได้อะไรกลับมา
      const text = await response.text();
      console.log("Response จาก GAS:", text); 

      res.status(200).json({ status: "done", raw: text });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}