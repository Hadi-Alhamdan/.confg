// productivity_app/js/api.js

const API_BASE_URL = 'http://localhost:3000/api'; // Your backend API base URL

// --- Helper function for handling API responses ---
async function handleResponse(response) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'An unknown error occurred, and error details could not be parsed.' }));
        console.error('API Error:', response.status, errorData);
        const errorMessage = errorData.error || errorData.message || `Request failed with status ${response.status}`;
        // In a real app, you'd show this error to the user in the UI
        // For now, we can alert or throw a more specific error
        alert(`API Error: ${errorMessage}`); // Simple feedback for now
        throw new Error(errorMessage);
    }
    // For 204 No Content, response.json() will fail, so handle it
    if (response.status === 204) {
        return null; // Or an empty object, or a specific success indicator
    }
    return response.json(); // For 200 OK, 201 Created etc.
}

// --- API Functions for Habits ---

/**
 * Fetches all active (non-archived) habits.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of habit objects.
 */
async function fetchActiveHabits() {
    const response = await fetch(`${API_BASE_URL}/habits`);
    const data = await handleResponse(response);
    return data.data; // The habits are in the 'data' property
}

/**
 * Fetches all archived habits.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of archived habit objects.
 */
async function fetchArchivedHabits() {
    const response = await fetch(`${API_BASE_URL}/habits/archived`);
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Creates a new habit.
 * @param {Object} habitData - The data for the new habit.
 * @param {string} habitData.name - The name of the habit.
 * @param {number} habitData.current_weight - The weight of the habit (0-1).
 * @returns {Promise<Object>} A promise that resolves to the created habit object.
 */
async function createHabit(habitData) {
    const response = await fetch(`${API_BASE_URL}/habits`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(habitData),
    });
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Updates an existing habit.
 * @param {number} habitId - The ID of the habit to update.
 * @param {Object} updateData - The data to update (e.g., { name, current_weight, is_archived }).
 * @returns {Promise<Object>} A promise that resolves to the success message from the API.
 */
async function updateHabit(habitId, updateData) {
    const response = await fetch(`${API_BASE_URL}/habits/${habitId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
    });
    return handleResponse(response); // PUT usually returns a success message or the updated object
}

/**
 * Deletes a habit.
 * @param {number} habitId - The ID of the habit to delete.
 * @returns {Promise<Object>} A promise that resolves to the success message from the API.
 */
async function deleteHabit(habitId) {
    const response = await fetch(`${API_BASE_URL}/habits/${habitId}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
}

/**
 * Marks a habit as complete for a specific date.
 * @param {number} habitId - The ID of the habit.
 * @param {string} [date] - The date in 'YYYY-MM-DD' format. Defaults to today if not provided.
 * @returns {Promise<Object>} A promise that resolves to the completion data.
 */
async function markHabitComplete(habitId, date = null) {
    const body = date ? { date } : {}; // Send an empty body if no date, or {date: "YYYY-MM-DD"}
    const response = await fetch(`${API_BASE_URL}/habits/${habitId}/complete`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body), // Even if body is {}, stringify it for consistency
    });
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Fetches completion records for a specific habit.
 * @param {number} habitId - The ID of the habit.
 * @param {string} [startDate] - Optional start date 'YYYY-MM-DD'.
 * @param {string} [endDate] - Optional end date 'YYYY-MM-DD'.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of completion objects.
 */
async function fetchHabitCompletions(habitId, startDate, endDate) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const queryString = params.toString();
    const url = `${API_BASE_URL}/habits/${habitId}/completions${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url);
    const data = await handleResponse(response);
    return data.data;
}

// --- API Functions for Settings (example from Phase 0) ---
/**
 * Fetches current settings.
 * @returns {Promise<Object>} A promise that resolves to the settings object.
 */
async function fetchSettings() {
    const response = await fetch(`${API_BASE_URL}/settings`);
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Updates settings.
 * @param {Object} settingsData - The settings data to update.
 * @returns {Promise<Object>} A promise that resolves to the API response.
 */
async function updateSettings(settingsData) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(settingsData),
    });
    return handleResponse(response);
}

// You can export these functions if you plan to use ES6 modules in the browser
// For now, they will be globally available if this script is included before other JS files
// that use them. Or, you can wrap them in an object:
// const apiClient = { fetchActiveHabits, createHabit, ... };