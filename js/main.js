// Main application logic: Handles navigation and content loading.

document.addEventListener('DOMContentLoaded', () => {
    const sidebarNav = document.getElementById('sidebar-nav');
    const contentArea = document.getElementById('content-area');
    const sidebarLinks = sidebarNav ? sidebarNav.querySelectorAll('.nav-link[data-lesson-url]') : [];

    // Function to load lesson from URL hash
    function loadLessonFromHash() {
        if (window.location.hash.startsWith('#lesson=')) {
            const hashParts = window.location.hash.split('=');
            if (hashParts.length === 2 && hashParts[1].length > 0) {
                const lessonId = hashParts[1];
                const linkToLoad = document.querySelector(`.nav-link[data-lesson-url$="${lessonId}.html"]`);
                if (linkToLoad) {
                    // First ensure the link is visible (expand parent categories if needed)
                    const parentCollapses = linkToLoad.closest('.collapse') ? 
                        [linkToLoad.closest('.collapse')] : [];
                    
                    parentCollapses.forEach(collapse => {
                        if (collapse && typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
                            new bootstrap.Collapse(collapse).show();
                        }
                    });
                    
                    // Then click the link after a brief delay to ensure UI is ready
                    setTimeout(() => linkToLoad.click(), 100);
                }
            }
        }
    }

    // --- Navigation Logic ---
    if (sidebarNav) {
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
            
            // Close sidebar on navigation (for all screen sizes)
            closeSidebar();

            try {
                // Show loading indicator
                if (contentArea) {
                    contentArea.innerHTML = '<div class="d-flex justify-content-center align-items-center" style="min-height: 300px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
                } else {
                    console.error("Content area element not found");
                    return;
                }

                // Fetch the lesson content
                const response = await fetch(lessonUrl);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${lessonUrl}`);
                }
                const lessonHtml = await response.text();

                // Inject the fetched HTML into the content area
                contentArea.innerHTML = lessonHtml;
                
                // Scroll to top of the page
                window.scrollTo(0, 0);

                // Re-initialize Prism.js for syntax highlighting on the new content
                if (typeof Prism !== 'undefined') {
                    // Defer to ensure the DOM has been fully updated
                    setTimeout(() => {
                        try {
                            Prism.highlightAll();
                        } catch (e) {
                            console.error("Error highlighting code with Prism:", e);
                        }
                    }, 0);
                }

                // Initialize the SQL Sandbox controls if its elements are present
                if (document.getElementById('sql-input') && typeof window.initSqlSandbox === 'function') {
                    // Show sandbox loading state
                    const queryStatus = document.getElementById('query-status');
                    if (queryStatus) {
                        queryStatus.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Initializing...';
                        queryStatus.className = 'status-running';
                    }
                    
                    window.initSqlSandbox();
                }

                // Update browser history/URL
                history.pushState(
                    { lesson: lessonUrl }, 
                    '', 
                    `#lesson=${lessonUrl.split('/').pop().replace('.html','')}`
                );

            } catch (error) {
                console.error("Error loading lesson:", error);
                if (contentArea) {
                    contentArea.innerHTML = `<div class="alert alert-danger" role="alert">
                        <h4>Error Loading Lesson</h4>
                        <p>Failed to load content from <code>${lessonUrl || 'unknown'}</code>.</p>
                        <p>Details: ${error.message}</p>
                        <p>Please ensure the file exists and the web server is configured correctly (check CORS if running locally without a server).</p>
                    </div>`;
                }
                
                // Make sure to reset loading states in the SQL sandbox if it exists
                const queryStatus = document.getElementById('query-status');
                if (queryStatus) {
                    queryStatus.innerHTML = '<i class="bi bi-x-octagon-fill me-1"></i> Error!';
                    queryStatus.className = 'status-error';
                }
            }
        });
    } else {
        console.error("Sidebar navigation element not found");
    }

    // Function to update the active link in the sidebar
    function updateActiveLink(activeLink) {
        // Remove 'active' class from all links
        if (sidebarLinks && sidebarLinks.length) {
            sidebarLinks.forEach(link => link.classList.remove('active'));
            // Add 'active' class to the clicked link
            if (activeLink) {
                activeLink.classList.add('active');
            }
        }
    }
    
    // Function to close the sidebar
    function closeSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const backdrop = document.querySelector('.sidebar-backdrop');
        
        if (sidebar && backdrop) {
            sidebar.classList.remove('show');
            backdrop.classList.remove('show');
            document.body.classList.remove('sidebar-open');
        }
    }

    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.lesson) {
            const lessonId = event.state.lesson.split('/').pop().replace('.html', '');
            const linkToLoad = document.querySelector(`.nav-link[data-lesson-url$="${lessonId}.html"]`);
            if (linkToLoad) {
                linkToLoad.click();
            }
        }
    });

    // Sidebar toggle functionality
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
    }

    // Check for URL hash on initial load and handle hash changes
    loadLessonFromHash();
    window.addEventListener('hashchange', loadLessonFromHash);
});