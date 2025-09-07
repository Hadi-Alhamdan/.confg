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


// --- API Functions for Tasks ---

/**
 * Fetches tasks. Can be filtered by date.
 * @param {string} [date] - Optional date in 'YYYY-MM-DD' format to filter tasks.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of task objects.
 */
async function fetchTasks(date = null) {
    let url = `${API_BASE_URL}/tasks`;
    if (date) {
        url += `?date=${date}`;
    }
    const response = await fetch(url);
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Creates a new task.
 * @param {Object} taskData - The data for the new task.
 * @param {string} taskData.description - The description of the task.
 * @param {string} taskData.target_date - The target date for the task ('YYYY-MM-DD').
 * @param {boolean} [taskData.is_assigned=true] - Whether the task is assigned.
 * @returns {Promise<Object>} A promise that resolves to the created task object.
 */
async function createTask(taskData) {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
    });
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Updates an existing task.
 * @param {number} taskId - The ID of the task to update.
 * @param {Object} updateData - The data to update (e.g., { description, is_done }).
 * @returns {Promise<Object>} A promise that resolves to the success message from the API.
 */
async function updateTask(taskId, updateData) {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
    });
    return handleResponse(response);
}

/**
 * Deletes a task.
 * @param {number} taskId - The ID of the task to delete.
 * @returns {Promise<Object>} A promise that resolves to the success message from the API.
 */
async function deleteTask(taskId) {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'DELETE',
    });
    return handleResponse(response);
}

// --- API Functions for Time Logs ---

/**
 * Logs a new block of time to the database.
 * @param {Object} timeLogData - The data for the new time log.
 * @param {string} timeLogData.type - 'productive' or 'distracting'.
 * @param {string} timeLogData.start_time - The start time in ISO 8601 format.
 * @param {string} timeLogData.end_time - The end time in ISO 8601 format.
 * @returns {Promise<Object>} A promise that resolves to the created time log object.
 */
async function logTimeBlock(timeLogData) {
    const response = await fetch(`${API_BASE_URL}/timelogs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(timeLogData),
    });
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Fetches all time logs for a specific date.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of time log objects.
 */
async function fetchTimeLogsForDate(date) {
    if (!date) {
        throw new Error("A date is required to fetch time logs.");
    }
    const response = await fetch(`${API_BASE_URL}/timelogs?date=${date}`);
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Fetches habit completions for a specific date.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of completion objects for that day.
 */
async function fetchHabitCompletionsForDate(date) {
    if (!date) throw new Error("Date is required");
    const response = await fetch(`${API_BASE_URL}/habits/completions?date=${date}`);
    const data = await handleResponse(response);
    return data.data;
}

/**
 * Fetches the daily score for a specific date.
 * The backend will calculate it if it's not already in the database.
 * @param {string} date - The date in 'YYYY-MM-DD' format.
 * @returns {Promise<Object>} A promise that resolves to the daily score object.
 *                           The object will contain properties like:
 *                           date, habit_score_component, task_score_component,
 *                           time_score_component, streak_bonus_component, total_daily_score.
 */
async function fetchDailyScore(date) {
    if (!date) {
        throw new Error("A date is required to fetch the daily score.");
    }
    // Validate date format (simple check, backend does more thorough validation)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error("Invalid date format. Please use YYYY-MM-DD.");
    }

    const response = await fetch(`${API_BASE_URL}/daily-score/${date}`);
    const data = await handleResponse(response);
    return data.data; // The score object is in the 'data' property
}

/**
 * Fetches the current streak count.
 * @returns {Promise<number>} A promise that resolves to the number of current streak days.
 */
async function fetchCurrentStreak() {
    const response = await fetch(`${API_BASE_URL}/streak`);
    const data = await handleResponse(response);
    return data.data.current_streak_days; // Directly return the number
}