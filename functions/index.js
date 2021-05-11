const functions = require("firebase-functions");
const spotify = require("./spotify");
const lineApp = require("./lineapp");


exports.LineWebhook = functions.https.onRequest(async (req, res) => {
    if (req.query.code !== undefined) {
        // กรณีผู้ใช้ทำการ Login ด้วย Spotify จะมี Callback กลับมาเพื่อทำการเชื่อมต่อกับ Spotify API
        spotify.receivedAuthCode(req.query.code);
        res.status(200).send("Login Successfully!");

    } else {
        let event = req.body.events[0];
        let message;
        if (event.type === 'message' && event.message.type === 'text') {
            // กรณีผู้ใช้พิมพ์ข้อความเพื่อค้นหาตามชื่อเพลง/ศิลปิน
            message = event.message.text;
            let searchInput = event.message.text;
            message = await lineApp.searchMusic(searchInput);

        } else if (event.type === 'postback') {
            // กรณีผู้ใช้กดปุ่ม Add (เพื่อเพิ่มเพลง) หรือกดปุ่ม More (เพื่อค้นหาเพลงเพิ่มเติม)
            message = await lineApp.receivedPostback(event)
        }

        await lineApp.replyMessage(event.replyToken, message);
        return res.status(200).send(req.method);
    }
});