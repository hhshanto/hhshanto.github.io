document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    let searchData;

    // Fetch the search index
    fetch('/assets/js/search.json')
        .then(response => response.json())
        .then(data => {
            searchData = data;
        });

    searchInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) {
            searchResults.innerHTML = '';
            return;
        }

        const results = searchData.filter(item => 
            item.title.toLowerCase().includes(query) || 
            item.content.toLowerCase().includes(query)
        );

        displayResults(results);
    });

    function displayResults(results) {
        searchResults.innerHTML = results.length ? 
            results.map(r => `
                <li>
                    <a href="${r.url}">${r.title}</a>
                    <p>${r.content.substring(0, 150)}...</p>
                </li>
            `).join('') : 
            '<li>No results found</li>';
    }
});