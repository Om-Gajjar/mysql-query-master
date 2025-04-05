// Make initSqlJs available globally or manage scope appropriately
const DEBUG = false; // Debug flag for conditional logging

// Helper function for conditional logging
function log(message) {
    if (DEBUG) {
        console.log(message);
    }
}

// Using let for better block scoping
let SQL; // Will hold the SQL object returned by initSqlJs
let dbInstance = null; // Renamed from db for clarity and better memory management

// Configuration for sql.js
const config = {
    // CDN dependency - if this URL becomes unavailable, the app will break
    // Consider hosting these files locally for more reliable operation
    locateFile: filename => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${filename}`
};

// --- Database Schema and Initial Data ---
const initialSchemaSQL = `
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS departments;

    CREATE TABLE departments (
        department_id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        signup_date DATE,
        department_id INTEGER,
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
    );
`;

const initialDataSQL = `
    INSERT INTO departments (department_name) VALUES
    ('Human Resources'),
    ('Engineering'),
    ('Marketing'),
    ('Sales');

    INSERT INTO users (name, email, signup_date, department_id) VALUES
    ('Alice Wonderland', 'alice@example.com', '2024-01-15', 2), -- Engineering
    ('Bob The Builder', 'bob@example.com', '2024-02-20', 2),    -- Engineering
    ('Charlie Chaplin', 'charlie@example.com', '2023-12-01', 3), -- Marketing
    ('Diana Prince', 'diana@example.com', '2024-03-10', 1),    -- Human Resources
    ('Ethan Hunt', 'ethan@example.com', '2023-11-05', NULL);    -- No department
`;

// --- Core Functions ---

// Function to check if SQL query is safe to run
function isSqlSafe(sql) {
    // Regular expression to catch DROP operations even with comments or spacing
    const dangerousPatterns = [
        /\s*DROP\s+(?:\/\*.*?\*\/)?\s*(?:DATABASE|SCHEMA|TABLE)/i,
        /\s*ALTER\s+(?:\/\*.*?\*\/)?\s*(?:DATABASE|SCHEMA)/i,
        /\s*TRUNCATE\s+(?:\/\*.*?\*\/)?\s*(?:DATABASE|SCHEMA|TABLE)/i
    ];
    
    return !dangerousPatterns.some(pattern => pattern.test(sql));
}

// Cleanup function for database instance
function cleanupDatabase() {
    if (dbInstance) {
        try {
            dbInstance.close();
        } catch (e) {
            console.error("Error closing database:", e);
        }
        dbInstance = null;
    }
}

// Initializes sql.js and creates/resets the database instance
async function initializeOrResetDatabase() {
    const statusDiv = document.getElementById('db-status'); // Optional status indicator
    if (statusDiv) {
        statusDiv.textContent = "Initializing database...";
    }

    try {
        // Clean up existing DB if it exists (needed for reset)
        cleanupDatabase();

        // Initialize SQL.js if it hasn't been already
        if (!SQL) {
            log("Initializing SQL.js library...");
            if (typeof initSqlJs !== 'function') {
                throw new Error("SQL.js library (initSqlJs) not found. Make sure it's properly loaded.");
            }
            SQL = await initSqlJs(config);
            log("SQL.js library initialized.");
        }

        // Create a new database instance
        log("Creating new in-memory database instance...");
        dbInstance = new SQL.Database();
        log("Database instance created.");

        // Run schema and data setup
        log("Applying initial schema...");
        dbInstance.run(initialSchemaSQL);
        log("Schema applied.");

        log("Inserting initial data...");
        dbInstance.run(initialDataSQL);
        log("Initial data inserted.");

        log("Database setup complete.");
        if (statusDiv) {
            statusDiv.textContent = "Database ready.";
        }
        return true; // Indicate success

    } catch (err) {
        console.error("Database initialization/reset failed:", err);
        if (statusDiv) {
            statusDiv.textContent = "Database initialization failed!";
        }
        
        // Display a more prominent error to the user if the sandbox UI is present
        const queryStatus = document.getElementById('query-status');
        const queryOutput = document.getElementById('query-output');
        if (queryStatus) {
            queryStatus.innerHTML = '<i class="bi bi-x-octagon-fill me-1"></i> FATAL ERROR';
            queryStatus.className = 'status-error';
        }
        if (queryOutput) {
            queryOutput.textContent = `Could not initialize the database engine: ${err.message}\nCheck browser console for details.`;
            queryOutput.className = 'error';
        }
        
        dbInstance = null; // Ensure db is null on failure
        return false; // Indicate failure
    }
}

// Centralized error handling function
function handleError(error, element, isQuery = false) {
    console.error("SQL Error:", error);
    
    // Determine error type and provide helpful messages
    let errorMessage = error.message || "An unknown error occurred";
    let errorClass = "alert-danger";
    
    if (errorMessage.includes("syntax error")) {
        errorMessage = "SQL Syntax Error: " + errorMessage;
    } else if (errorMessage.includes("no such table")) {
        errorMessage = "Table Not Found: " + errorMessage;
    } else if (isQuery && errorMessage.includes("constraint failed")) {
        errorMessage = "Constraint Violation: " + errorMessage;
        errorClass = "alert-warning";
    }
    
    // Update UI
    element.innerHTML = `
        <div class="alert ${errorClass}">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            ${errorMessage}
        </div>
    `;
    
    // Update status indicator if it exists
    const statusElement = document.getElementById('query-status');
    if (statusElement) {
        statusElement.innerHTML = '<i class="bi bi-x-circle me-1"></i> Error';
        statusElement.className = 'fw-bold text-danger ms-auto';
    }
}

// Function to set up event listeners for the sandbox controls ONCE the elements exist
function setupSandboxControls() {
    const runQueryBtn = document.getElementById('run-query-btn');
    const resetDbBtn = document.getElementById('reset-db-btn');
    const sqlInput = document.getElementById('sql-input');
    const queryStatus = document.getElementById('query-status');
    const queryOutput = document.getElementById('query-output');

    if (!runQueryBtn || !sqlInput || !queryStatus || !queryOutput || !resetDbBtn) {
        // Don't log warning here, as some pages might not have a sandbox
        return;
    }

    log("Attaching sandbox control listeners...");

    // --- Run Query Button ---
    runQueryBtn.onclick = () => {
        if (!dbInstance) {
            queryStatus.innerHTML = '<i class="bi bi-x-octagon-fill me-1"></i> Error: Database not ready!';
            queryStatus.className = 'status-error';
            queryOutput.textContent = "The database engine is not initialized. Try resetting or reloading.";
            queryOutput.className = 'error';
            return;
        }

        const sqlString = sqlInput.value.trim();
        queryStatus.innerHTML = '<i class="bi bi-hourglass-split me-1"></i> Running...';
        queryStatus.className = 'status-running';
        queryOutput.textContent = "";
        queryOutput.className = ''; // Reset class (remove 'error' if present)

        if (!sqlString) {
            queryStatus.innerHTML = '<i class="bi bi-circle me-1"></i> Ready';
            queryStatus.className = '';
            queryOutput.textContent = "Please enter an SQL query.";
            return;
        }

        try {
            // WARNING: In a production app, you should use parameterized queries instead
            // This is a learning tool where direct SQL execution is intentional
            
            // Check for dangerous SQL operations
            if (!isSqlSafe(sqlString)) {
                throw new Error("This query contains potentially harmful operations that are not allowed in the sandbox");
            }
            
            // Execute the SQL query
            const results = dbInstance.exec(sqlString);

            // Format and display the results
            queryOutput.textContent = formatResults(results);
            queryStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Success!';
            queryStatus.className = 'status-success';
        } catch (error) {
            handleError(error, queryOutput, true);
            queryStatus.innerHTML = '<i class="bi bi-x-octagon-fill me-1"></i> Error!';
            queryStatus.className = 'status-error';
        }
    };

    // --- Reset Database Button ---
    resetDbBtn.onclick = async () => {
        log("Reset button clicked.");
        queryStatus.innerHTML = '<i class="bi bi-arrow-repeat me-1"></i> Resetting...';
        queryStatus.className = 'status-running';
        queryOutput.textContent = "";
        queryOutput.className = '';
        runQueryBtn.disabled = true; // Disable buttons during reset
        resetDbBtn.disabled = true;

        const success = await initializeOrResetDatabase(); // Re-initialize

        runQueryBtn.disabled = false; // Re-enable buttons
        resetDbBtn.disabled = false;

        if (success) {
            queryStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Reset OK!';
            queryStatus.className = 'status-success';
            queryOutput.textContent = "Sample tables (users, departments) and data have been restored.";
        } else {
            // Error message handled within initializeOrResetDatabase
            queryStatus.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-1"></i> Reset Failed!';
            queryStatus.className = 'status-error';
        }
    };

    // Set initial state
    queryStatus.innerHTML = '<i class="bi bi-circle me-1"></i> Ready';
    queryStatus.className = '';

    log("Sandbox listeners attached.");
}

// Function to format the results from db.exec() into a readable table string
function formatResults(results) {
    if (!results || results.length === 0) {
        try {
            const rowsModified = dbInstance.getRowsModified();
            return `Query executed successfully. Rows affected: ${rowsModified}`;
        } catch (e) {
            return "Query executed successfully. No rows returned or modified.";
        }
    }

    const MAX_CELL_DISPLAY_LENGTH = 100; // Reasonable limit to prevent display issues
    
    let output = "";
    results.forEach((result, index) => {
        if (index > 0) output += "\n---\n"; // Separator

        // Headers
        const headers = result.columns;
        const colWidths = headers.map(h => h.length);

        // Calculate max width for each column based on data
        result.values.forEach(row => {
            row.forEach((val, i) => {
                const displayVal = val === null ? 'NULL' : String(val);
                const len = Math.min(displayVal.length, MAX_CELL_DISPLAY_LENGTH);
                if (len > colWidths[i]) {
                    colWidths[i] = len;
                }
            });
        });

        // Format header row
        output += headers.map((h, i) => String(h).padEnd(colWidths[i])).join(" | ") + "\n";
        // Format separator line
        output += colWidths.map(w => "-".repeat(w)).join("-|-") + "\n";

        // Format data rows
        result.values.forEach(row => {
            output += row.map((val, i) => {
                const displayVal = val === null ? 'NULL' : String(val);
                const truncatedVal = displayVal.length > MAX_CELL_DISPLAY_LENGTH ? 
                    displayVal.substring(0, MAX_CELL_DISPLAY_LENGTH) + '...' : 
                    displayVal;
                return truncatedVal.padEnd(colWidths[i]);
            }).join(" | ") + "\n";
        });
    });

    return output;
}

// --- Global Initialization ---
// Expose the function to set up controls so main.js can call it after loading content
window.initSqlSandbox = setupSandboxControls;

// Initialize the database ONCE when the script first loads.
// Subsequent resets will call initializeOrResetDatabase again via the button.
document.addEventListener('DOMContentLoaded', () => {
    initializeOrResetDatabase(); // Initial database creation
});

// Add database cleanup on page unload and pagehide (for mobile browsers)
window.addEventListener('beforeunload', cleanupDatabase);
window.addEventListener('pagehide', cleanupDatabase);

if (DEBUG) {
    console.log("Sandbox script loaded. Waiting for DOMContentLoaded to initialize DB.");
}