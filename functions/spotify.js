const SpotifyWebApi = require("spotify-web-api-node");

class Spotify {

    constructor() {
        // Init การเชื่อมต่อกับ Spotify
        this.api = new SpotifyWebApi({
            clientId: 'xxxxx',
            clientSecret: 'xxxxxx',
            redirectUri: 'https://us-central1-linemepotify.cloudfunctions.net/LineWebhook'
        });

        // สร้าง Login URL เพื่อสามารเข้าถึงสิทธิต่างๆของเครืื่องหลักที่ต่อลำโพง
        const scopes = ["playlist-read-private", "playlist-modify", "playlist-modify-private"];
        const authorizeUrl = this.api.createAuthorizeURL(scopes, "default-state");
        console.log(`Authorization required. Please visit ${authorizeUrl}`);
    }

    isAuthTokenValid() {
        if (this.auth == undefined || this.auth.expires_at == undefined) {
            return false;
        }
        else if (this.auth.expires_at < new Date()) {
            return false;
        }
        return true;
    }

    async initialized() {
        const playlists = [];

        const limit = 50;
        let offset = -limit;
        let total = 0;

        // ทำการ Download Playlist ทั้งหมดจาก Spotify ของผู้ใช้ที่ได้ Login เก็บไว้ในตัวแปร playlists
        do {
            offset += limit;
            const result = await this.api.getUserPlaylists(undefined, { offset: offset, limit: 50 });
            total = result.body.total;

            const subset = result.body.items.map((playlist) => {
                return { id: playlist.id, name: playlist.name };
            });
            playlists.push(...subset);

        } while ((offset + limit) < total);

        // ทำการค้นหา Playlist ที่ชื่อว่า 'Linemepotify'
        // ถ้าไม่เจอ ให้ทำการสร้าง Playlist ขึ้นมาใหม่
        const index = playlists.findIndex((playlist) => playlist.name === 'Linemepotify');
        if (index >= 0) {
            this.playlist = playlists[index].id;
            console.log('Playlist already exist');
        }
        else {
            let result;
            // สร้าง Playlist ใหม่
            await this.api.createPlaylist('Linemepotify', { 'description': 'My Spotify Chatbot', 'public': true }).then(function(data) {
                    result = data.body.id;
                    console.log('Created Linemepotify playlist! ' + result);
                }, function (err) {
                    console.log('Something went wrong!', err);
                });
            this.playlist = result;
        }

        console.log("Spotify is ready!");
    }

    async refreshAuthToken() {
        const result = await this.api.refreshAccessToken();

        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + result.body.expires_in);
        this.settings.auth.access_token = result.body.access_token;
        this.settings.auth.expires_at = expiresAt;

        this.api.setAccessToken(result.body.access_token);
    }

    async receivedAuthCode(authCode) {

        // ได้รับ Authorization code ตอนที่ Call back URL ถูกเรียก
        // จากนั้นเอา Code นี้ไปรับ Access token กับ Refresh token อีกที 
        const authFlow = await this.api.authorizationCodeGrant(authCode);
        this.auth = authFlow.body;

        // เก็บค่่าของ expire time ไว้ใช้ตอนเรียก refresh token
        const expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + authFlow.body.expires_in);
        this.auth.expires_at = expiresAt;

        // ส่งค่า Tokens ทั้งสองให้กับ library ของ Spotify
        this.api.setAccessToken(authFlow.body.access_token);
        this.api.setRefreshToken(authFlow.body.refresh_token);

        // this.api.setAccessToken(this.auth.access_token);	
        // this.api.setRefreshToken(this.auth.refresh_token);

        // เริ่มทำการ Init การเชื่อมต่อกับ Spotify
        this.initialized();
    }

    async searchTracks(terms, skip = 0, limit = 10) {
        if (!this.isAuthTokenValid()) {
            await this.refreshAuthToken();
        }

        const result = await this.api.searchTracks(terms, { offset: skip, limit: limit })
        return result.body.tracks;
    }

    async queueTrack(track) {
        if (!this.isAuthTokenValid()) {
            await this.refreshAuthToken();
        }
        return this.api.addTracksToPlaylist(this.playlist, [`spotify:track:${track}`]);
    }
}

module.exports = new Spotify();