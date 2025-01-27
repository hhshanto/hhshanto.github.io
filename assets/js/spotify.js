class SpotifyNowPlaying {
    constructor() {
        this.redirectUri = 'https://hhshanto.github.io'; // Your site URL
        this.scope = 'user-read-currently-playing user-read-playback-state';
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

        const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(this.scope)}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&code_challenge_method=S256&code_challenge=${codeChallenge}`;
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

        const response = await fetch('/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code: code })
        });

        const tokenData = await response.json();
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
            document.getElementById('album-cover').src = '';
            return;
        }

        const data = await response.json();
        if (data && data.item) {
            document.getElementById('track-name').textContent = data.item.name;
            document.getElementById('artist-name').textContent = data.item.artists.map(artist => artist.name).join(', ');
            document.getElementById('album-cover').src = data.item.album.images[0].url;
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