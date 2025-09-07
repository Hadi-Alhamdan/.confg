// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('Productivity App Initialized');

    // --- DOM Element References for Dashboard ---
    const dashboardDailyScoreEl = document.getElementById('dashboard-daily-score');
    const dashboardHabitScoreEl = document.getElementById('dashboard-habit-score');
    const dashboardTaskScoreEl = document.getElementById('dashboard-task-score');
    const dashboardTimeScoreEl = document.getElementById('dashboard-time-score');
    const dashboardStreakBonusEl = document.getElementById('dashboard-streak-bonus');
    const dashboardStreakDaysEl = document.getElementById('dashboard-streak-days');


    // Navigation elements
    const mainNavigation = document.getElementById('main-navigation');
    const navButtons = document.querySelectorAll('#main-navigation .nav-btn');
    const viewSections = document.querySelectorAll('.view-section');

    // Quick Action buttons on Dashboard
    const quickAddTaskBtn = document.getElementById('quick-add-task-btn');
    const quickLogTimeBtn = document.getElementById('quick-log-time-btn');
    const quickViewHabitsBtn = document.getElementById('quick-view-habits-btn');

    // --- Utility to get today's date string ---
    const getTodayString = () => new Date().toISOString().slice(0, 10);

    // --- Dashboard Functions ---

    /**
     * Fetches and displays the score for a given date on the dashboard.
     * @param {string} date - The date in 'YYYY-MM-DD' format.
     */
    async function displayDashboardScore(date) {
        try {
            const scoreData = await fetchDailyScore(date); // From api.js

            if (scoreData && typeof scoreData.total_daily_score === 'number') {
                dashboardDailyScoreEl.textContent = scoreData.total_daily_score.toFixed(2);
                dashboardHabitScoreEl.textContent = scoreData.habit_score_component.toFixed(2);
                dashboardTaskScoreEl.textContent = scoreData.task_score_component.toFixed(2);
                dashboardTimeScoreEl.textContent = scoreData.time_score_component.toFixed(2);
                dashboardStreakBonusEl.textContent = scoreData.streak_bonus_component.toFixed(2);
            } else {
                dashboardDailyScoreEl.textContent = 'N/A';
                dashboardHabitScoreEl.textContent = 'N/A';
                dashboardTaskScoreEl.textContent = 'N/A';
                dashboardTimeScoreEl.textContent = 'N/A';
                dashboardStreakBonusEl.textContent = 'N/A';
                console.warn("Score data received is not in the expected format or missing.", scoreData);
            }
        } catch (error) {
            console.error(`Failed to fetch or display dashboard score for ${date}:`, error);
            dashboardDailyScoreEl.textContent = 'Error';
            // Update other elements to show error or N/A
            dashboardHabitScoreEl.textContent = 'Err';
            dashboardTaskScoreEl.textContent = 'Err';
            dashboardTimeScoreEl.textContent = 'Err';
            dashboardStreakBonusEl.textContent = 'Err';
        }
    }

    /**
     * Fetches and displays the current streak.
     * (Placeholder - full streak logic is in Phase 5)
     */
    async function displayCurrentStreak() {
        try {
            const streakDays = await fetchCurrentStreak(); // Use the new API function
            dashboardStreakDaysEl.textContent = `${streakDays} days`;
        } catch (error) {
            console.error('Failed to fetch or display streak:', error);
            dashboardStreakDaysEl.textContent = 'Error';
        }
    }

   // --- View Management ---
    function showView(viewIdToShow) {
        viewSections.forEach(section => {
            section.style.display = 'none'; // Hide all sections
        });

        const activeSection = document.getElementById(viewIdToShow);
        if (activeSection) {
            activeSection.style.display = 'block'; // Show the target section
        } else {
            console.error(`View with ID ${viewIdToShow} not found. Defaulting to dashboard.`);
            document.getElementById('dashboard-section').style.display = 'block';
        }

        // Update active state for navigation buttons
        navButtons.forEach(button => {
            if (button.dataset.view === viewIdToShow) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    // --- Event Handlers for Navigation ---
    mainNavigation.addEventListener('click', (event) => {
        if (event.target.matches('.nav-btn')) {
            const viewId = event.target.dataset.view;
            if (viewId) {
                showView(viewId);
            }
        }
    });


    // --- Event Handlers for Dashboard Quick Actions ---
    if (quickAddTaskBtn) { // Check if elements exist before adding listeners
        quickAddTaskBtn.addEventListener('click', () => {
            showView('tasks-section');
            // Optional: You could also focus the add task input field here
            const taskDescriptionInput = document.getElementById('task-description');
            if (taskDescriptionInput) taskDescriptionInput.focus();
        });
    }

    if (quickLogTimeBtn) {
        quickLogTimeBtn.addEventListener('click', () => {
            showView('timetracker-section');
            // Optional: Focus manual log type or start time
            const logTypeSelect = document.getElementById('log-type');
            if (logTypeSelect) logTypeSelect.focus();
        });
    }
    
    if (quickViewHabitsBtn) {
        quickViewHabitsBtn.addEventListener('click', () => {
            showView('habits-section');
        });
    }

    // --- Global Event Listener for Dashboard Updates (Example) ---
    // This is a simple way to trigger a dashboard refresh.
    // In a more complex app, you might use custom events or a state management library.
    document.body.addEventListener('dataChanged', (event) => {
        console.log('Data changed event received, refreshing dashboard for date:', event.detail.date);
        if (event.detail && event.detail.date) {
            displayDashboardScore(event.detail.date);
        } else {
            displayDashboardScore(getTodayString()); // Default to today if no date specified
        }
        // Potentially refresh streak too if it could have changed
        displayCurrentStreak();
    });


    // --- Initialization ---
    function initializeApp() {
        // Set default view
        showView('dashboard-section'); // Make dashboard visible by default

        // Load initial dashboard data
        displayDashboardScore(getTodayString());
        displayCurrentStreak();

        // Setup navigation (placeholder - we'll do this properly later)
        // Example:
        // document.getElementById('nav-dashboard-btn').addEventListener('click', () => showView('dashboard-section'));
        // document.getElementById('nav-habits-btn').addEventListener('click', () => showView('habits-section'));
    }

    initializeApp(); // Run the app initialization
});