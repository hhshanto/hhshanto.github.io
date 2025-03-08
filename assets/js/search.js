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
            searchResults.innerHTML = '<div class="no-results">No results found</div>';
            searchResults.style.display = 'block';
            return;
        }

        searchResults.innerHTML = '';
        
        // Check if dark mode is enabled
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        
        // Apply dark mode class if needed
        if (isDarkMode) {
            searchResults.classList.add('dark-mode-results');
        } else {
            searchResults.classList.remove('dark-mode-results');
        }

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            // Create elements instead of using innerHTML for better control
            const link = document.createElement('a');
            link.href = result.url;
            
            const title = document.createElement('h3');
            title.className = 'search-result-title';
            title.textContent = result.title;
            
            link.appendChild(title);
            
            if (result.abstract) {
                const abstract = document.createElement('p');
                abstract.className = 'search-result-abstract';
                abstract.textContent = result.abstract.substring(0, 150) + '...';
                link.appendChild(abstract);
            }
            
            const meta = document.createElement('div');
            meta.className = 'result-meta';
            
            if (result.category) {
                const category = document.createElement('span');
                category.className = 'search-result-category';
                category.textContent = result.category;
                meta.appendChild(category);
            }
            
            const date = document.createElement('span');
            date.className = 'search-result-date';
            date.textContent = result.date;
            meta.appendChild(date);
            
            link.appendChild(meta);
            resultItem.appendChild(link);
            searchResults.appendChild(resultItem);
        });

        searchResults.style.display = 'block';
    }
    
    // Update results when theme changes
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            // If search results are visible, refresh them to update styling
            if (searchResults.style.display === 'block' && searchInput.value.length >= 2) {
                const query = searchInput.value.toLowerCase();
                const results = searchData.filter(item => {
                    const titleMatch = item.title.toLowerCase().includes(query);
                    const abstractMatch = item.abstract && item.abstract.toLowerCase().includes(query);
                    const contentMatch = item.content && item.content.toLowerCase().includes(query);
                    return titleMatch || abstractMatch || contentMatch;
                }).slice(0, 5);
                
                displayResults(results);
            }
        });
    }

    // Close search results when clicking outside
    document.addEventListener('click', function(event) {
        if (!searchInput.contains(event.target) && !searchResults.contains(event.target)) {
            searchResults.style.display = 'none';
        }
    });
});