if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSpotify);
} else {
    initializeSpotify();
}

function initializeSpotify() {
    new SpotifyNowPlaying();
}

class SpotifyNowPlaying {
    constructor() {
        this.clientId = 'a232f71a59cc43f2b2047319ab3d8502'; // Your client ID
        this.redirectUri = 'https://hhshanto.github.io'; // Your site URL
        this.scope = 'user-read-currently-playing user-read-playback-state';
        
        if (window.location.search.includes('code=')) {
            this.handleAuthCallback();
        } else if (!this.getAccessToken()) {
            this.authorize();
        } else {
            this.updateNowPlaying();
            setInterval(() => this.updateNowPlaying(), 30000);
        }
    }

    async authorize() {
        const state = Math.random().toString(36).substring(7);
        localStorage.setItem('spotify_auth_state', state);

        const codeVerifier = this.generateCodeVerifier();
        localStorage.setItem('code_verifier', codeVerifier);
        
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: 'code',
            redirect_uri: this.redirectUri,
            state: state,
            scope: this.scope,
            code_challenge_method: 'S256',
            code_challenge: codeChallenge
        });

        window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    generateCodeVerifier() {
        const array = new Uint32Array(56);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode.apply(null, array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode.apply(null, new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async handleAuthCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const storedState = localStorage.getItem('spotify_auth_state');
        const codeVerifier = localStorage.getItem('code_verifier');

        localStorage.removeItem('spotify_auth_state');

        if (!state || !storedState || state !== storedState) {
            console.log('Starting new authorization flow');
            this.authorize();
            return;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: this.redirectUri,
                    client_id: this.clientId,
                    code_verifier: codeVerifier
                })
            });

            const data = await response.json();
            this.saveTokens(data);
            window.history.replaceState({}, document.title, '/');
            this.updateNowPlaying();
        } catch (error) {
            console.error('Error getting access token:', error);
        }
    }

    async updateNowPlaying() {
        const accessToken = this.getAccessToken();
        if (!accessToken) return;

        try {
            const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.status === 204) {
                this.updateUI('Not Playing', '');
                return;
            }

            const data = await response.json();
            if (data.item) {
                this.updateUI(data.item.name, data.item.artists[0].name);
            }
        } catch (error) {
            console.error('Error fetching now playing:', error);
            if (error.status === 401) {
                await this.refreshToken();
            }
        }
    }

    updateUI(trackName, artistName) {
        document.getElementById('track-name').textContent = trackName;
        document.getElementById('artist-name').textContent = artistName;
    }

    saveTokens(data) {
        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.setItem('spotify_token_expires', Date.now() + (data.expires_in * 1000));
    }

    getAccessToken() {
        const expiry = localStorage.getItem('spotify_token_expires');
        if (expiry && Date.now() > parseInt(expiry)) {
            this.refreshToken();
            return null;
        }
        return localStorage.getItem('spotify_access_token');
    }

    async refreshToken() {
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) {
            this.authorize();
            return;
        }

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                    client_id: this.clientId
                })
            });

            const data = await response.json();
            this.saveTokens(data);
        } catch (error) {
            console.error('Error refreshing token:', error);
            this.authorize();
        }
    }
}