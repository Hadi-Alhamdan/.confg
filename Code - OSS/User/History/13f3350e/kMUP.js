// js/settings.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const restDaysForm = document.getElementById('rest-days-form');
    const statusMessageEl = document.getElementById('rest-days-status');

    // Checkbox elements (could also query them all at once)
    const restDayCheckboxes = {
        rest_day_monday: document.getElementById('rest-day-monday'),
        rest_day_tuesday: document.getElementById('rest-day-tuesday'),
        rest_day_wednesday: document.getElementById('rest-day-wednesday'),
        rest_day_thursday: document.getElementById('rest-day-thursday'),
        rest_day_friday: document.getElementById('rest-day-friday'),
        rest_day_saturday: document.getElementById('rest-day-saturday'),
        rest_day_sunday: document.getElementById('rest-day-sunday'),
    };

    // --- Functions ---

    /**
     * Fetches current settings and populates the rest days form.
     */
    async function loadRestDaySettings() {
        try {
            const settings = await fetchSettings(); // from api.js
            if (settings) {
                for (const dayKey in restDayCheckboxes) {
                    if (restDayCheckboxes[dayKey] && settings.hasOwnProperty(dayKey)) {
                        // SQLite stores boolean as 1 (true) or 0 (false)
                        restDayCheckboxes[dayKey].checked = settings[dayKey] === 1;
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
            displayStatusMessage("Error loading settings.", "error");
        }
    }

    /**
     * Handles the submission of the rest days form.
     */
    async function handleSaveRestDays(event) {
        event.preventDefault();
        const settingsData = {};
        for (const dayKey in restDayCheckboxes) {
            if (restDayCheckboxes[dayKey]) {
                settingsData[dayKey] = restDayCheckboxes[dayKey].checked;
            }
        }

        try {
            await updateSettings(settingsData); // from api.js
            displayStatusMessage("Rest day settings saved successfully!", "success");
        } catch (error) {
            console.error("Failed to save settings:", error);
            displayStatusMessage("Failed to save settings. Please try again.", "error");
        }
    }

    /**
     * Displays a status message to the user.
     * @param {string} message - The message to display.
     * @param {string} type - 'success' or 'error'.
     */
    function displayStatusMessage(message, type) {
        statusMessageEl.textContent = message;
        statusMessageEl.className = `status-message ${type}`; // Add type for styling
        statusMessageEl.style.display = 'block';
        setTimeout(() => {
            statusMessageEl.style.display = 'none';
            statusMessageEl.textContent = '';
            statusMessageEl.className = 'status-message';
        }, 3000); // Hide message after 3 seconds
    }


    // --- Initial Setup when Settings View is Shown ---
    // Similar to chart.js, we need to initialize when the view becomes active.
    function initializeSettingsPage() {
        console.log("Settings page initialized/shown.");
        loadRestDaySettings();
    }

    const settingsSection = document.getElementById('settings-section');
    if (settingsSection) {
        let isSettingsVisible = settingsSection.style.display !== 'none'; // Initial check
        const observer = new MutationObserver((mutationsList) => {
            for(const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    const currentlyVisible = settingsSection.style.display !== 'none';
                    if (currentlyVisible && !isSettingsVisible) { // Became visible
                        initializeSettingsPage();
                    }
                    isSettingsVisible = currentlyVisible;
                }
            }
        });
        observer.observe(settingsSection, { attributes: true });

        // If already visible on page load (e.g. if it's the default for some reason)
        if (isSettingsVisible) {
            initializeSettingsPage();
        }
    }
    
    // Attach event listener to the form
    if (restDaysForm) {
        restDaysForm.addEventListener('submit', handleSaveRestDays);
    }
});