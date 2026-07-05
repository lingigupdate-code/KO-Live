const { IncomingForm } = require('formidable');
const fs = require('fs');

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    const file = Array.isArray(files.slip) ? files.slip[0] : files.slip;
    const base64File = fs.readFileSync(file.filepath).toString('base64');

    const response = await fetch('https://script.google.com/macros/s/AKfycbzn2TOg3fu3ng81M76lAIgMpWoJNIQ_Yl7CCXRCsccFe92e9FaMht33-T41sG84V0v6/exec', {
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
    
    res.status(200).json(await response.json());
  });
}