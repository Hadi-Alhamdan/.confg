// js/timeTracker.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const timerDisplay = document.getElementById('timer-display');
    const currentTimerTask = document.getElementById('current-timer-task');
    const startProductiveBtn = document.getElementById('start-productive-btn');
    const startDistractingBtn = document.getElementById('start-distracting-btn');
    const stopTimerBtn = document.getElementById('stop-timer-btn');
    const manualLogForm = document.getElementById('manual-log-form');
    const totalProductiveTimeEl = document.getElementById('total-productive-time');
    const totalDistractingTimeEl = document.getElementById('total-distracting-time');

    // --- State Management ---
    let timerInterval = null;
    let timerStartTime = null;
    let timerType = null; // 'productive' or 'distracting'

    // --- Utility Functions ---
    const getTodayString = () => new Date().toISOString().slice(0, 10);

    /**
     * Formats total seconds into HH:MM:SS format.
     * @param {number} totalSeconds - The total seconds to format.
     * @returns {string} The formatted time string.
     */
    function formatTime(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds]
            .map(val => val.toString().padStart(2, '0'))
            .join(':');
    }

    /**
     * Formats total minutes into a more readable "Xh Ym" format.
     * @param {number} totalMinutes - The total minutes to format.
     * @returns {string} The formatted string.
     */
    function formatMinutesToHours(totalMinutes) {
        if (isNaN(totalMinutes) || totalMinutes === 0) return '0h 0m';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    }

    // --- Core Timer Logic ---

    /**
     * Starts a new timer of a given type.
     * @param {string} type - 'productive' or 'distracting'.
     */
    function startTimer(type) {
        if (timerInterval) {
            // A timer is already running
            alert('A timer is already running. Please stop it before starting a new one.');
            return;
        }

        timerType = type;
        timerStartTime = new Date();
        timerInterval = setInterval(updateTimerDisplay, 1000);

        // Update UI
        currentTimerTask.textContent = `Timing: ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        startProductiveBtn.style.display = 'none';
        startDistractingBtn.style.display = 'none';
        stopTimerBtn.style.display = 'inline-block';
    }

    /**
     * Stops the currently running timer and logs the time block.
     */
    async function stopTimer() {
        if (!timerInterval) return;

        clearInterval(timerInterval);
        const endTime = new Date();

        try {
            await logTimeBlock({
                type: timerType,
                start_time: timerStartTime.toISOString(),
                end_time: endTime.toISOString()
            });
            // After successful logging, update the daily totals
            await updateDailyTotals();
            document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: getTodayString() } }));
        } catch (error) {
            console.error('Failed to log time block:', error);
            alert('Could not save the time log. Please try again.');
        } finally {
            // Reset state and UI
            timerInterval = null;
            timerStartTime = null;
            timerType = null;
            timerDisplay.textContent = '00:00:00';
            currentTimerTask.textContent = 'No timer running';
            startProductiveBtn.style.display = 'inline-block';
            startDistractingBtn.style.display = 'inline-block';
            stopTimerBtn.style.display = 'none';
        }
    }

    /**
     * Updates the timer display every second.
     */
    function updateTimerDisplay() {
        if (!timerStartTime) return;
        const now = new Date();
        const elapsedSeconds = Math.round((now - timerStartTime) / 1000);
        timerDisplay.textContent = formatTime(elapsedSeconds);
    }

    // --- Data Fetching and Display ---

    /**
     * Fetches today's time logs and updates the total display.
     */
    async function updateDailyTotals() {
        try {
            const logs = await fetchTimeLogsForDate(getTodayString());
            let productiveMinutes = 0;
            let distractingMinutes = 0;

            logs.forEach(log => {
                if (log.type === 'productive') {
                    productiveMinutes += log.duration_minutes;
                } else if (log.type === 'distracting') {
                    distractingMinutes += log.duration_minutes;
                }
            });

            totalProductiveTimeEl.textContent = formatMinutesToHours(productiveMinutes);
            totalDistractingTimeEl.textContent = formatMinutesToHours(distractingMinutes);

        } catch (error) {
            console.error('Failed to update daily time totals:', error);
        }
    }
    
    // --- Event Handlers ---

    /**
     * Handles the submission of the manual time log form.
     */
    async function handleManualLogSubmit(event) {
        event.preventDefault();
        const formData = new FormData(manualLogForm);
        
        // The input type 'datetime-local' provides a value like '2025-06-07T10:30'
        // We need to convert it to a full ISO string with 'Z' for UTC.
        const startTimeLocal = formData.get('start_time');
        const endTimeLocal = formData.get('end_time');
        const type = formData.get('type');

        if (!startTimeLocal || !endTimeLocal || !type) {
            alert('Please fill all fields.');
            return;
        }

        const start_time = new Date(startTimeLocal).toISOString();
        const end_time = new Date(endTimeLocal).toISOString();

        try {
            await logTimeBlock({ type, start_time, end_time });
            manualLogForm.reset();
            await updateDailyTotals(); // Refresh totals after logging
            document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: new Date(formData.get('start_time')).toISOString().slice(0,10) } }));
        } catch(error) {
            console.error('Failed to manually log time:', error);
            // Error is alerted by api.js
        }
    }


    // --- Initial Setup ---
    startProductiveBtn.addEventListener('click', () => startTimer('productive'));
    startDistractingBtn.addEventListener('click', () => startTimer('distracting'));
    stopTimerBtn.addEventListener('click', stopTimer);
    manualLogForm.addEventListener('submit', handleManualLogSubmit);

    // Initial load of today's totals
    updateDailyTotals();
});