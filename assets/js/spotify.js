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
        this.clientSecret = 'c80190a561b949729fdbb161629b69c1'; // Your client secret
        this.redirectUri = 'https://hhshanto.github.io'; // Your site URL
        this.scope = 'user-read-currently-playing user-read-playback-state';
        this.tokenEndpoint = 'https://accounts.spotify.com/api/token';
        this.apiEndpoint = 'https://api.spotify.com/v1/me/player/currently-playing';

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
        localStorage.setItem('spotify_code_verifier', codeVerifier);

        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${this.clientId}&scope=${encodeURIComponent(this.scope)}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
        window.location = authUrl;
    }

    async handleAuthCallback() {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const state = params.get('state');
        const storedState = localStorage.getItem('spotify_auth_state');

        if (state !== storedState) {
            console.error('State mismatch');
            return;
        }

        const codeVerifier = localStorage.getItem('spotify_code_verifier');
        const tokenResponse = await fetch(this.tokenEndpoint, {
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

        const tokenData = await tokenResponse.json();
        localStorage.setItem('spotify_access_token', tokenData.access_token);
        window.history.replaceState({}, document.title, '/');
        this.updateNowPlaying();
    }

    getAccessToken() {
        return localStorage.getItem('spotify_access_token');
    }

    async updateNowPlaying() {
        const accessToken = this.getAccessToken();
        if (!accessToken) return;

        const response = await fetch(this.apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (response.status === 204) {
            document.getElementById('track-name').textContent = 'Not Playing';
            document.getElementById('artist-name').textContent = '';
            return;
        }

        const data = await response.json();
        if (data && data.item) {
            document.getElementById('track-name').textContent = data.item.name;
            document.getElementById('artist-name').textContent = data.item.artists.map(artist => artist.name).join(', ');
        }
    }

    generateCodeVerifier() {
        const array = new Uint32Array(56 / 2);
        window.crypto.getRandomValues(array);
        return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
    }

    async generateCodeChallenge(codeVerifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await window.crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
}