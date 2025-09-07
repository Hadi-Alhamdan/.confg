// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('Productivity App Initialized for Dashboard-Centric View');

    // --- Main View & Navigation DOM Elements ---
    const mainNavigation = document.getElementById('main-navigation');
    const navButtons = document.querySelectorAll('#main-navigation .nav-btn');
    const viewSections = document.querySelectorAll('.view-section');

    // --- Dashboard Specific DOM Elements ---
    const dashboardDatePicker = document.getElementById('dashboard-date-picker');
    const selectedDateDisplayElements = document.querySelectorAll('.selected-date-display'); // For multiple places showing the date

    // Score display elements
    const dashboardDailyScoreEl = document.getElementById('dashboard-daily-score');
    const dashboardHabitScoreEl = document.getElementById('dashboard-habit-score');
    const dashboardTaskScoreEl = document.getElementById('dashboard-task-score');
    const dashboardTimeScoreEl = document.getElementById('dashboard-time-score');
    const dashboardStreakBonusEl = document.getElementById('dashboard-streak-bonus');
    const dashboardStreakDaysEl = document.getElementById('dashboard-streak-days');
    const markSelectedDayRestCheckbox = document.getElementById('mark-selected-day-rest-checkbox');
    const selectedDayStatusMessageEl = document.getElementById('selected-day-status-message');


    // Habits on Dashboard
    const dashboardHabitsListEl = document.getElementById('dashboard-habits-list');
    const dashboardHabitsLoadingEl = document.getElementById('dashboard-habits-loading');
    const manageHabitsBtn = document.getElementById('manage-habits-btn');

    // Tasks on Dashboard
    const dashboardTasksListEl = document.getElementById('dashboard-tasks-list');
    const dashboardTasksLoadingEl = document.getElementById('dashboard-tasks-loading');
    const dashboardAddTaskForm = document.getElementById('dashboard-add-task-form');
    const dashboardTaskDescriptionInput = document.getElementById('dashboard-task-description');

    const gotoTimetrackerBtn = document.getElementById('goto-timetracker-btn');
    const gotoHistoryBtn = document.getElementById('goto-history-btn');
    const gotoDataMgmtBtn = document.getElementById('goto-data-mgmt-btn');

    // Time Summary on Dashboard
    const dashboardTotalProductiveTimeEl = document.getElementById('dashboard-total-productive-time');
    const dashboardTotalDistractingTimeEl = document.getElementById('dashboard-total-distracting-time');

    // Edit Task Modal elements (assuming these are still used from task.js or now app.js)
    const editTaskModal = document.getElementById('edit-task-modal');
    const closeEditTaskModalBtn = document.getElementById('close-edit-task-modal');
    const editTaskForm = document.getElementById('edit-task-form');
    const editTaskIdInput = document.getElementById('edit-task-id');
    const editTaskDescriptionInput = document.getElementById('edit-task-description');
    const editTaskTargetDateInput = document.getElementById('edit-task-target-date');
    const editTaskIsAssignedCheckbox = document.getElementById('edit-task-is-assigned');

    //Scatchpad
    const dailyNotesTextarea = document.getElementById('daily-notes-textarea');
    const dailyNotesStatusEl = document.getElementById('daily-notes-status');

    // --- State ---
    let currentDashboardDate = new Date().toISOString().slice(0, 10);
    let todaysCompletionsForDashboard = new Set(); // For habits on dashboard
    let notesSaveTimeout = null;

    // --- Utility Functions ---
    const getTodayString = () => new Date().toISOString().slice(0, 10);
    const formatDateForDisplay = (dateString) => {
        if (dateString === getTodayString()) return "Today";
        const dateObj = new Date(dateString + "T00:00:00"); // Ensure local interpretation
        return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };
    function formatMinutesToHours(totalMinutes) { /* ... keep your existing function ... */
        if (isNaN(totalMinutes) || totalMinutes === 0) return '0h 0m';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return `${hours}h ${minutes}m`;
    }


    // --- Core Data Loading Function for Dashboard ---
    async function loadDashboardData(date) {
        console.log(`Loading dashboard data for: ${date}`);
        currentDashboardDate = date;
        dashboardDatePicker.value = date; // Sync date picker

        selectedDateDisplayElements.forEach(el => el.textContent = formatDateForDisplay(date));

        // Parallel fetch
        try {
            await Promise.all([
                displayDashboardScore(date),
                displayCurrentStreak(), // Streak is generally "current" not for selected date
                loadAndRenderHabitsForDashboard(date),
                loadAndRenderTasksForDashboard(date),
                updateDashboardTimeTotals(date)
            ]);
        } catch (error) {
            console.error("Error loading dashboard data bundle:", error);
            // Display a general error on the dashboard if needed
        }
    }

    // --- Dashboard Score Display ---
    async function displayDashboardScore(date) {
        try {
            const scoreData = await fetchDailyScore(date); // From api.js
            if (scoreData) {
                dashboardDailyScoreEl.textContent = scoreData.total_daily_score.toFixed(2);
                dashboardHabitScoreEl.textContent = scoreData.habit_score_component.toFixed(2);
                dashboardTaskScoreEl.textContent = scoreData.task_score_component.toFixed(2);
                dashboardTimeScoreEl.textContent = scoreData.time_score_component.toFixed(2);
                dashboardStreakBonusEl.textContent = scoreData.streak_bonus_component.toFixed(2);
                if (markSelectedDayRestCheckbox) {
                    markSelectedDayRestCheckbox.checked = scoreData.is_manually_marked_rest_day === 1;
                }
            } else {
                dashboardDailyScoreEl.textContent = 'N/A';
                dashboardHabitScoreEl.textContent = 'N/A';
                dashboardTaskScoreEl.textContent = 'N/A';
                dashboardTimeScoreEl.textContent = 'N/A';
                dashboardStreakBonusEl.textContent = 'N/A';
                console.warn("Score data received is not in the expected format or missing.", scoreData);
                if (date === getTodayString() && markTodayRestCheckbox) {
                    markTodayRestCheckbox.checked = false; // Default if no score data or unexpected format
                }

            }
            if (dailyNotesTextarea) {
                dailyNotesTextarea.value = scoreData ? (scoreData.notes || '') : '';
            }
            if (dailyNotesStatusEl) dailyNotesStatusEl.textContent = ''; // Clear status on load
        } catch (error) {
            console.error(`Failed to fetch or display dashboard score for ${date}:`, error);
            dashboardDailyScoreEl.textContent = 'Error';
            dashboardHabitScoreEl.textContent = 'Err';
            dashboardTaskScoreEl.textContent = 'Err';
            dashboardTimeScoreEl.textContent = 'Err';
            dashboardStreakBonusEl.textContent = 'Err';
            if (dailyNotesTextarea) dailyNotesTextarea.value = 'Could not load notes.';
        }
    }

    async function displayCurrentStreak() {
        try {
            const streakDays = await fetchCurrentStreak(); // Use the new API function
            dashboardStreakDaysEl.textContent = `${streakDays} days`;
        } catch (error) {
            console.error('Failed to fetch or display streak:', error);
            dashboardStreakDaysEl.textContent = 'Error';
        }
    }

    // --- Dashboard Habits Display & Interaction ---
    function createDashboardHabitElement(habit) {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-3 bg-dracula-bg rounded shadow'; // Tailwind
        li.dataset.habitId = habit.id;

        const isCompleted = todaysCompletionsForDashboard.has(habit.id);
        if (isCompleted) {
            li.classList.add('opacity-60'); // Visually indicate completion
        }

        li.innerHTML = `
            <div class="flex-grow">
                <span class="font-medium ${isCompleted ? 'line-through text-dracula-comment' : 'text-dracula-fg'}">${habit.name}</span>
                <span class="text-xs text-dracula-comment ml-2">(W: ${habit.current_weight})</span>
            </div>
            <button class="dashboard-habit-complete-btn btn ${isCompleted ? 'secondary' : 'bg-dracula-green text-dracula-bg'} !py-1 !px-2 text-xs">
                ${isCompleted ? 'Undo' : 'Complete'}
            </button>
        `;
        return li;
    }

    async function loadAndRenderHabitsForDashboard(date) {
        if (dashboardHabitsLoadingEl) dashboardHabitsLoadingEl.style.display = 'block';
        if (dashboardHabitsListEl) dashboardHabitsListEl.innerHTML = '';
        try {
            const [activeHabits, completions] = await Promise.all([
                fetchActiveHabits(), // Fetches all active master habits
                fetchHabitCompletionsForDate(date) // Fetches completions for the *selected* date
            ]);
            todaysCompletionsForDashboard = new Set(completions.map(c => c.habit_id));
            if (dashboardHabitsListEl) {
                if (activeHabits.length === 0) {
                    dashboardHabitsListEl.innerHTML = '<p class="text-dracula-comment italic">No habits defined yet. Go to "Manage Habits".</p>';
                } else {
                    activeHabits.forEach(habit => {
                        dashboardHabitsListEl.appendChild(createDashboardHabitElement(habit));
                    });
                }
            }
        } catch (error) {
            console.error("Failed to load habits for dashboard:", error);
            if (dashboardHabitsListEl) dashboardHabitsListEl.innerHTML = '<p class="text-dracula-red">Error loading habits.</p>';
        } finally {
            if (dashboardHabitsLoadingEl) dashboardHabitsLoadingEl.style.display = 'none';
        }
    }

    // --- Dashboard Tasks Display & Interaction ---
    function createDashboardTaskElement(task) {
        const li = document.createElement('li');
        li.className = `task-item flex justify-between items-center p-3 bg-dracula-bg rounded shadow ${task.is_done ? 'opacity-60' : ''}`;
        li.dataset.taskId = task.id;

        li.innerHTML = `
            <div class="task-main flex items-center flex-grow">
                <input type="checkbox" class="dashboard-task-checkbox form-checkbox" ${task.is_done ? 'checked' : ''}>
                <span class="task-description ml-3 ${task.is_done ? 'line-through text-dracula-comment' : 'text-dracula-fg'}">${task.description}</span>
            </div>
            <div class="task-details flex items-center space-x-3">
                ${task.is_assigned ? '<span class="px-2 py-0.5 text-xs rounded-full bg-dracula-cyan text-dracula-bg">Assigned</span>' : ''}
                <button class="dashboard-edit-task-btn text-dracula-purple hover:text-dracula-pink text-xs" title="Edit Task">EDIT</button>
                <button class="dashboard-delete-task-btn text-dracula-red hover:opacity-75 text-lg" title="Delete Task">×</button>
            </div>
        `;
        return li;
    }

    async function loadAndRenderTasksForDashboard(date) {
        if (dashboardTasksLoadingEl) dashboardTasksLoadingEl.style.display = 'block';
        if (dashboardTasksListEl) dashboardTasksListEl.innerHTML = '';
        try {
            const tasks = await fetchTasks(date); // Fetches tasks for the selected date
            if (dashboardTasksListEl) {
                if (tasks.length === 0) {
                    dashboardTasksListEl.innerHTML = '<p class="text-dracula-comment italic">No tasks for this day.</p>';
                } else {
                    tasks.forEach(task => {
                        dashboardTasksListEl.appendChild(createDashboardTaskElement(task));
                    });
                }
            }
        } catch (error) {
            console.error("Failed to load tasks for dashboard:", error);
            if (dashboardTasksListEl) dashboardTasksListEl.innerHTML = '<p class="text-dracula-red">Error loading tasks.</p>';
        } finally {
            if (dashboardTasksLoadingEl) dashboardTasksLoadingEl.style.display = 'none';
        }
    }

    // --- Dashboard Time Summary Display ---
    async function updateDashboardTimeTotals(date) {
        try {
            const logs = await fetchTimeLogsForDate(date);
            let productiveMinutes = 0;
            let distractingMinutes = 0;
            logs.forEach(log => {
                if (log.type === 'productive') productiveMinutes += log.duration_minutes;
                else if (log.type === 'distracting') distractingMinutes += log.duration_minutes;
            });
            if (dashboardTotalProductiveTimeEl) dashboardTotalProductiveTimeEl.textContent = formatMinutesToHours(productiveMinutes);
            if (dashboardTotalDistractingTimeEl) dashboardTotalDistractingTimeEl.textContent = formatMinutesToHours(distractingMinutes);
        } catch (error) {
            console.error(`Failed to update time totals for ${date}:`, error);
        }
    }

    // --- View Management
    function showView(viewIdToShow) {
        console.log(`Attempting to show view: ${viewIdToShow}`);
        viewSections.forEach(section => {
            section.style.display = 'none';
            console.log(`Hid section: ${section.id}`);
        });
        const activeSection = document.getElementById(viewIdToShow);
        if (activeSection) {
            activeSection.style.display = 'block';
            if (viewIdToShow === 'history-section' && window.chartJsModule && typeof window.chartJsModule.initializeOrRefreshCharts === 'function') {
                window.chartJsModule.initializeOrRefreshCharts();
            }
            // Add similar init for other pages if needed, e.g., habit management
            if (viewIdToShow === 'habits-management-section' && window.habitManagementModule && typeof window.habitManagementModule.initializeHabitManagementPage === 'function') {
                window.habitManagementModule.initializeHabitManagementPage();
            }
        } else {
            document.getElementById('dashboard-section').style.display = 'block';
        }
        navButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.view === viewIdToShow);
        });
    }

    // --- Event Listeners ---
    // Main Navigation
    if (mainNavigation) {
        mainNavigation.addEventListener('click', (event) => {
            if (event.target.matches('.nav-btn')) {
                const viewId = event.target.dataset.view;
                if (viewId) showView(viewId);
            }
        });
    }

    // Dashboard Date Picker
    if (dashboardDatePicker) {
        dashboardDatePicker.addEventListener('change', (event) => {
            loadDashboardData(event.target.value);
        });
    }

    // Mark Selected Day as Rest Checkbox
    if (markSelectedDayRestCheckbox) {
        markSelectedDayRestCheckbox.addEventListener('change', async () => {
            const isRest = markSelectedDayRestCheckbox.checked;
            try {
                const response = await updateDailyStatus(currentDashboardDate, isRest);
                if (selectedDayStatusMessageEl) {
                    selectedDayStatusMessageEl.textContent = `Day marked as ${isRest ? 'rest' : 'active'}. Score updated.`;
                    setTimeout(() => selectedDayStatusMessageEl.textContent = '', 3000);
                }
                // Dispatch dataChanged to refresh score display and potentially streak
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: currentDashboardDate } }));
            } catch (error) {
                console.error(`Failed to mark ${currentDashboardDate} as rest=${isRest}:`, error);
                markSelectedDayRestCheckbox.checked = !isRest; // Revert on failure
                if (selectedDayStatusMessageEl) selectedDayStatusMessageEl.textContent = 'Update failed.';
            }
        });
    }

    // Event delegation for habits list on dashboard
    if (dashboardHabitsListEl) {
        dashboardHabitsListEl.addEventListener('click', async (event) => {
            if (event.target.classList.contains('dashboard-habit-complete-btn')) {
                const habitItem = event.target.closest('li[data-habit-id]');
                const habitId = parseInt(habitItem.dataset.habitId);
                const isCurrentlyCompleted = todaysCompletionsForDashboard.has(habitId);

                try {
                    if (isCurrentlyCompleted) {
                        await unmarkHabitComplete(habitId, currentDashboardDate);
                    } else {
                        await markHabitComplete(habitId, currentDashboardDate);
                    }
                    // Refresh habits and score for the current dashboard date
                    await loadAndRenderHabitsForDashboard(currentDashboardDate);
                    document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: currentDashboardDate } }));
                } catch (error) {
                    console.error("Dashboard habit action failed:", error);
                }
            }
        });
    }

    // Add Task Form on Dashboard
    if (dashboardAddTaskForm) {
        dashboardAddTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const description = dashboardTaskDescriptionInput.value.trim();
            const is_assigned = document.getElementById('dashboard-task-assigned').checked;
            if (!description) {
                alert("Task description cannot be empty.");
                return;
            }
            try {
                await createTask({ description, target_date: currentDashboardDate, is_assigned });
                dashboardTaskDescriptionInput.value = ''; // Clear input
                // Refresh tasks and score
                await loadAndRenderTasksForDashboard(currentDashboardDate);
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: currentDashboardDate } }));
            } catch (error) {
                console.error("Failed to add task from dashboard:", error);
            }
        });
    }

    // Event delegation for tasks list on dashboard (complete, delete, edit)
    if (dashboardTasksListEl) {
        dashboardTasksListEl.addEventListener('click', async (event) => {
            const taskItem = event.target.closest('li[data-task-id]');
            if (!taskItem) return;
            const taskId = parseInt(taskItem.dataset.taskId);

            if (event.target.classList.contains('dashboard-task-checkbox')) {
                const is_done = event.target.checked;
                try {
                    await updateTask(taskId, { is_done });
                    taskItem.classList.toggle('opacity-60', is_done);
                    if (is_done) event.target.nextElementSibling.classList.add('line-through', 'text-dracula-comment');
                    else event.target.nextElementSibling.classList.remove('line-through', 'text-dracula-comment');
                    document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: currentDashboardDate } }));
                } catch (error) {
                    console.error("Failed to update task from dashboard:", error);
                    event.target.checked = !is_done; // Revert
                }
            } else if (event.target.classList.contains('dashboard-delete-task-btn')) {
                if (confirm("Are you sure you want to delete this task?")) {
                    try {
                        await deleteTask(taskId);
                        await loadAndRenderTasksForDashboard(currentDashboardDate); // Refresh list
                        document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: currentDashboardDate } }));
                    } catch (error) {
                        console.error("Failed to delete task from dashboard:", error);
                    }
                }
            } else if (event.target.classList.contains('dashboard-edit-task-btn')) {
                // Logic to populate and show the existing edit task modal
                // This assumes your modal and its form elements (edit-task-id, etc.) are still in index.html
                // And that your task.js (or now app.js) has logic to handle the modal form submission.
                // For now, let's just log it. We might move task editing logic here too.
                console.log("Edit task btn clicked for ID:", taskId);
                // Fetch task details to populate modal (or assume taskItem has enough info)
                const taskToEdit = (await fetchTasks(currentDashboardDate)).find(t => t.id === taskId);
                if (taskToEdit && editTaskModal) {
                    editTaskIdInput.value = taskToEdit.id;
                    editTaskDescriptionInput.value = taskToEdit.description;
                    editTaskTargetDateInput.value = taskToEdit.target_date;
                    editTaskIsAssignedCheckbox.checked = taskToEdit.is_assigned;
                    editTaskModal.style.display = 'flex';
                }
            }
        });
    }

    // Edit Task Modal Form Submission 
    if (editTaskForm) {
        editTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const id = parseInt(editTaskIdInput.value);
            const description = editTaskDescriptionInput.value;
            const target_date = editTaskTargetDateInput.value;
            const is_assigned = editTaskIsAssignedCheckbox.checked;
            try {
                await updateTask(id, { description, target_date, is_assigned });
                editTaskModal.style.display = 'none';
                await loadAndRenderTasksForDashboard(currentDashboardDate); // Refresh tasks on current dashboard view
                // If the target_date was changed, we might need to refresh the old date's score too
                // For simplicity, just dispatch for current dashboard date
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: currentDashboardDate } }));
                if (target_date !== currentDashboardDate) { // If task moved date
                    document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: target_date } }));
                }
            } catch (error) {
                console.error("Error saving edited task:", error);
                alert("Failed to save task changes.");
            }
        });
    }
    if (closeEditTaskModalBtn) {
        closeEditTaskModalBtn.addEventListener('click', () => editTaskModal.style.display = 'none');
    }

    if (manageHabitsBtn) {
        manageHabitsBtn.addEventListener('click', () => showView('habits-management-section'));
    }
    if (gotoTimetrackerBtn) {
        gotoTimetrackerBtn.addEventListener('click', () => showView('timetracker-section'));
    }
    if (gotoHistoryBtn) {
        gotoHistoryBtn.addEventListener('click', () => showView('history-section'));
    }
    if (gotoDataMgmtBtn) {
        gotoDataMgmtBtn.addEventListener('click', () => showView('data-management-section'));
    }

    if (dailyNotesTextarea) {
        dailyNotesTextarea.addEventListener('input', () => {
            if (dailyNotesStatusEl) {
                dailyNotesStatusEl.textContent = 'Saving...';
            }

            // Debounce the save function
            clearTimeout(notesSaveTimeout);
            notesSaveTimeout = setTimeout(async () => {
                const notes = dailyNotesTextarea.value;
                const date = currentDashboardDate; // Use the currently viewed date
                try {
                    await saveDailyNotes(date, notes);
                    if (dailyNotesStatusEl) {
                        dailyNotesStatusEl.textContent = `Saved at ${new Date().toLocaleTimeString()}`;
                    }
                } catch (error) {
                    console.error("Failed to save notes:", error);
                    if (dailyNotesStatusEl) {
                        dailyNotesStatusEl.textContent = 'Save failed.';
                        dailyNotesStatusEl.classList.add('text-dracula-red');
                    }
                }
            }, 1000); // Auto-save 1 second after user stops typing
        });
    }
    // Global dataChanged listener 
    document.body.addEventListener('dataChanged', (event) => {
        console.log('Global dataChanged event, refreshing dashboard score for date:', event.detail.date);
        // Only refresh if the event's date matches the currently viewed dashboard date,
        // or if it's a general refresh (no date, then use currentDashboardDate).
        const dateToRefresh = event.detail && event.detail.date ? event.detail.date : currentDashboardDate;
        if (dateToRefresh === currentDashboardDate || !event.detail.date) {
            displayDashboardScore(currentDashboardDate);
        }
        displayCurrentStreak(); // Streak is always "current"
    });

    // --- Initialization ---
    function initializeApp() {
        dashboardDatePicker.value = currentDashboardDate; // Set initial date picker value
        showView('dashboard-section');
        loadDashboardData(currentDashboardDate); // Load data for today by default
    }

    initializeApp();
});