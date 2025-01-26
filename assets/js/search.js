document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    searchInput.parentNode.appendChild(searchResults);

    let searchData = [];

    // Fetch search index
    fetch('/search.json')
        .then(response => response.json())
        .then(data => {
            searchData = data;
        });

    // Handle search input
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        const results = searchData.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const abstractMatch = item.abstract && item.abstract.toLowerCase().includes(query);
            const contentMatch = item.content && item.content.toLowerCase().includes(query);
            return titleMatch || abstractMatch || contentMatch;
        }).slice(0, 5);

        displayResults(results);
    });

    function displayResults(results) {
        if (results.length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        searchResults.innerHTML = '';
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <a href="${result.url}">
                    <h3>${result.title}</h3>
                    ${result.abstract ? `<p>${result.abstract.substring(0, 150)}...</p>` : ''}
                    <div class="result-meta">
                        <span>${result.category || ''}</span>
                        <span>${result.date}</span>
                    </div>
                </a>
            `;
            searchResults.appendChild(resultItem);
        });

        searchResults.style.display = 'block';
    }

    // Close search results when clicking outside
    document.addEventListener('click', function(event) {
        if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.style.display = 'none';
        }
    });
});