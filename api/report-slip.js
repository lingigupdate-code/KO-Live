const multer = require('multer');
const { google } = require('googleapis');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });
}

// -------------------------------------------------------------
const SPREADSHEET_ID = '1yQzB1BTHSLfoSF8DEuLHnTt_nji9aycgunE7MHsgAVY';
const DRIVE_FOLDER_ID = '15_LEt64HOd3oSINx3q3Dk4nhDJbnFe9J';
// -------------------------------------------------------------

const auth = new google.auth.GoogleAuth({
    credentials: {
        type: "service_account",
        project_id: process.env.GD_PROJECT_ID,
        private_key: process.env.GD_PRIVATE_KEY ? process.env.GD_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined,
        client_email: process.env.GD_CLIENT_EMAIL,
    },
    scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
    ],
});

async function uploadToDrive(file, authClient) {
    const drive = google.drive({ version: 'v3', auth: authClient });
    const imageStream = new Readable();
    imageStream.push(file.buffer);
    imageStream.push(null);

    const fileMetadata = {
        name: `Slip_${Date.now()}_${file.originalname}`,
        parents: [DRIVE_FOLDER_ID]
    };

    // อัปโหลดด้วยการระบุ supportsAllDrives: true เผื่อกรณีบัญชีของคุณเป็น Workspace
    const response = await drive.files.create({
        resource: fileMetadata, 
        media: { mimeType: file.mimetype, body: imageStream },
        fields: 'id, webViewLink',
        supportsAllDrives: true
    });

    return response.data.webViewLink;
}

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });
    
    try {
        await runMiddleware(req, res, upload.single('slip'));
        const { rooms, price, xUsername } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ message: 'ไม่พบไฟล์สลิป' });

        const authClient = await auth.getClient();
        const slipDriveLink = await uploadToDrive(file, authClient);
        
        const sheets = google.sheets({ version: 'v4', auth: authClient });
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Sheet1!A:E',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[new Date().toLocaleString('th-TH'), xUsername, rooms, price, slipDriveLink]] },
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports.config = { api: { bodyParser: false } };