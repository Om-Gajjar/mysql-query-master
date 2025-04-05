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
let db;  // Will hold the database instance

// Configuration for sql.js
const config = {
    // Required to load the wasm binary asynchronously. Of course, you can host it wherever you want
    // You can omit locateFile completely when running in node.js
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

// Initializes sql.js and creates/resets the database instance
async function initializeOrResetDatabase() {
    const statusDiv = document.getElementById('db-status'); // Optional status indicator
    if (statusDiv) {
        statusDiv.textContent = "Initializing database...";
    }

    try {
        // Close existing DB if it exists (needed for reset)
        if (db) {
            log("Closing existing database instance...");
            db.close();
            db = null; // Clear the reference
        }

        // Initialize SQL.js if it hasn't been already
        if (!SQL) {
            log("Initializing SQL.js library...");
            SQL = await initSqlJs(config);
            log("SQL.js library initialized.");
        }

        // Create a new database instance
        log("Creating new in-memory database instance...");
        db = new SQL.Database();
        log("Database instance created.");

        // Run schema and data setup
        log("Applying initial schema...");
        db.run(initialSchemaSQL);
        log("Schema applied.");

        log("Inserting initial data...");
        db.run(initialDataSQL);
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
        db = null; // Ensure db is null on failure
        return false; // Indicate failure
    }
}

// Function to set up event listeners for the sandbox controls ONCE the elements exist
function setupSandboxControls() {
    const runQueryBtn = document.getElementById('run-query-btn');
    const resetDbBtn = document.getElementById('reset-db-btn'); // New button
    const sqlInput = document.getElementById('sql-input');
    const queryStatus = document.getElementById('query-status');
    const queryOutput = document.getElementById('query-output');

    if (!runQueryBtn || !sqlInput || !queryStatus || !queryOutput || !resetDbBtn) {
        // Don't log warning here, as some pages might not have a sandbox
        return;
    }

    log("Attaching sandbox control listeners...");

    // --- Run Query Button ---
    runQueryBtn.onclick = () => { // Using onclick for simplicity
        if (!db) {
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

        // Removed setTimeout for direct execution
        try {
            // Execute the SQL query
            // db.exec() returns an array of result objects
            const results = db.exec(sqlString);

            // Format and display the results
            queryOutput.textContent = formatResults(results);
            queryStatus.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Success!';
            queryStatus.className = 'status-success';
        } catch (error) {
            console.error("SQL Execution Error:", error);
            queryStatus.innerHTML = '<i class="bi bi-x-octagon-fill me-1"></i> Error!';
            queryStatus.className = 'status-error';
            queryOutput.textContent = `Error: ${error.message}`;
            queryOutput.className = 'error';
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
        // This might happen for queries like INSERT, UPDATE, DELETE without returning clauses
        // Or if a SELECT query genuinely returns no rows
        try {
            const rowsModified = db.getRowsModified();
            return `Query executed successfully. Rows affected: ${rowsModified}`;
        } catch (e) {
            return "Query executed successfully. No rows returned or modified.";
        }
    }

    let output = "";
    results.forEach((result, index) => {
        if (index > 0) output += "\n---\n"; // Separator

        // Headers
        const headers = result.columns;
        const colWidths = headers.map(h => h.length);

        // Calculate max width for each column based on data
        result.values.forEach(row => {
            row.forEach((val, i) => {
                const len = (val === null ? 4 : String(val).length);
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
            output += row.map((val, i) => String(val === null ? 'NULL' : val).padEnd(colWidths[i])).join(" | ") + "\n";
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

if (DEBUG) {
    console.log("Sandbox script loaded. Waiting for DOMContentLoaded to initialize DB.");
}