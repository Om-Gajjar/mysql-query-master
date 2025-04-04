// Main application logic: Handles navigation and content loading.

document.addEventListener('DOMContentLoaded', () => {
    const sidebarNav = document.getElementById('sidebar-nav');
    const contentArea = document.getElementById('content-area');
    const sidebarLinks = sidebarNav.querySelectorAll('.nav-link[data-lesson-url]');

    // --- Navigation Logic ---
    sidebarNav.addEventListener('click', async (event) => {
        const targetLink = event.target.closest('a.nav-link[data-lesson-url]');

        if (!targetLink || targetLink.classList.contains('disabled')) {
             // Don't navigate if it's not a valid, enabled lesson link
            event.preventDefault();
            return;
        }

        event.preventDefault(); // Prevent default link behavior

        const lessonUrl = targetLink.getAttribute('data-lesson-url');
        if (!lessonUrl) return;

        // Update active state in sidebar
        updateActiveLink(targetLink);

        try {
            // Show loading indicator
            contentArea.innerHTML = '<div class="d-flex justify-content-center align-items-center" style="min-height: 300px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';

            // Fetch the lesson content
            const response = await fetch(lessonUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${lessonUrl}`);
            }
            const lessonHtml = await response.text();

            // Inject the fetched HTML into the content area
            contentArea.innerHTML = lessonHtml;

            // Re-initialize Prism.js for syntax highlighting on the new content
            Prism.highlightAll();

            // Initialize the SQL Sandbox controls if its elements are present
            if (document.getElementById('sql-input') && typeof window.initSqlSandbox === 'function') {
                window.initSqlSandbox(); // This function now just attaches listeners
            } else {
                console.warn("Sandbox elements not found in loaded content, skipping sandbox init.");
            }

            // Optional: Update browser history/URL if desired
            // history.pushState({ lesson: lessonUrl }, '', `#lesson=${lessonUrl.split('/').pop().replace('.html','')}`);

        } catch (error) {
            console.error("Error loading lesson:", error);
            contentArea.innerHTML = `<div class="alert alert-danger" role="alert">
                <h4>Error Loading Lesson</h4>
                <p>Failed to load content from <code>${lessonUrl || 'unknown'}</code>.</p>
                <p>Details: ${error.message}</p>
                <p>Please ensure the file exists and the web server is configured correctly (check CORS if running locally without a server).</p>
              </div>`;
        }
    });

    // Function to update the active link in the sidebar
    function updateActiveLink(activeLink) {
        // Remove 'active' class from all links
        sidebarLinks.forEach(link => link.classList.remove('active'));
        // Add 'active' class to the clicked link
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }

    // Sidebar toggle functionality for all screen sizes
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.querySelector('.sidebar-backdrop');

    if (sidebarToggle && sidebar && backdrop) {
        // Toggle sidebar when button is clicked
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            backdrop.classList.toggle('show');
            document.body.classList.toggle('sidebar-open');
        });
        
        // Close sidebar when backdrop is clicked
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('show');
            backdrop.classList.remove('show');
            document.body.classList.remove('sidebar-open');
        });
        
        // Close sidebar when a lesson is selected (for all screen sizes)
        sidebarLinks.forEach(link => {
            link.addEventListener('click', () => {
                sidebar.classList.remove('show');
                backdrop.classList.remove('show');
                document.body.classList.remove('sidebar-open');
            });
        });
    }

    // Set initial padding for the main content area to account for the toggle button
    if (contentArea) {
        // Additional padding is already set in CSS
        console.log("Content area initialized with padding for sidebar toggle");
    }

    // --- Initializations ---
    // Highlight any code blocks present on the initial page load (if any)
    // Prism.highlightAll(); // Called implicitly by autoloader script or can be called manually

    // Initialize the SQL Database (this happens via sandbox.js)
    console.log("Main app initialized. Waiting for sandbox DB...");

    // Optional: Add logic here to load a lesson based on URL hash on initial page load
    // if (window.location.hash.startsWith('#lesson=')) {
    //    const lessonId = window.location.hash.substring(8); // Get lesson ID from hash
    //    const linkToLoad = document.querySelector(`.nav-link[data-lesson-url$="${lessonId}.html"]`);
    //    if (linkToLoad) {
    //        linkToLoad.click(); // Simulate click to load the lesson
    //    }
    // }
});