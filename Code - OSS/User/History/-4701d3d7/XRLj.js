// js/habit.js

// This file handles all the UI logic for the Habits section.
// It uses functions from api.js to interact with the backend.

// Wait for the DOM to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const addHabitForm = document.getElementById('add-habit-form');
    const activeHabitsList = document.getElementById('active-habits-list');
    const archivedHabitsList = document.getElementById('archived-habits-list');
    const activeHabitsLoading = document.getElementById('active-habits-loading');
    const archivedHabitsLoading = document.getElementById('archived-habits-loading');

    // --- State ---
    // In a more complex app, this might be part of a larger state management system.
    // For now, we'll store today's completions to update the UI.
    let todaysCompletions = new Set(); // Stores IDs of habits completed today

    // --- Functions ---

    /**
     * Creates an HTML list item element for a single habit.
     * @param {Object} habit - The habit object from the API.
     * @returns {HTMLLIElement} The created list item element.
     */
    function createHabitElement(habit) {
        const li = document.createElement('li');
        li.className = 'habit-item';
        li.dataset.habitId = habit.id; // Store the ID on the element

        // Check if this habit has been completed today
        if (todaysCompletions.has(habit.id)) {
            li.classList.add('completed');
        }

        const isArchived = habit.is_archived;

        li.innerHTML = `
            <div class="habit-info">
                <span class="habit-name">${habit.name}</span>
                <span class="habit-weight">(Weight: ${habit.current_weight})</span>
            </div>
            <div class="habit-actions">
                ${!isArchived ? `<button class="complete-btn">${li.classList.contains('completed') ? 'Undo' : 'Complete'}</button>` : ''}
                <button class="archive-btn">${isArchived ? 'Unarchive' : 'Archive'}</button>
                <button class="delete-btn">Delete</button>
            </div>
        `;

        return li;
    }

    /**
     * Renders a list of habits into a given container element.
     * @param {Array<Object>} habits - An array of habit objects.
     * @param {HTMLElement} container - The UL element to render into.
     */
    function renderHabits(habits, container) {
        container.innerHTML = ''; // Clear previous content
        if (habits.length === 0) {
            container.innerHTML = '<p>No habits found.</p>';
            return;
        }
        habits.forEach(habit => {
            const habitElement = createHabitElement(habit);
            container.appendChild(habitElement);
        });
    }

    /**
     * Fetches and renders both active and archived habits.
     */
    async function loadAllHabits() {
        // Show loading indicators
        activeHabitsLoading.style.display = 'block';
        archivedHabitsLoading.style.display = 'block';

        try {
            // Fetch habits, but NOT completions here.
            const [activeHabits, archivedHabits] = await Promise.all([
                fetchActiveHabits(),
                fetchArchivedHabits(),
            ]);

            // Store today's completions to correctly style the UI
            //todaysCompletions = new Set(completions.map(c => c.habit_id));

            // Render the lists
            renderHabits(activeHabits, activeHabitsList);
            renderHabits(archivedHabits, archivedHabitsList);

        } catch (error) {
            console.error('Failed to load habits:', error);
            activeHabitsList.innerHTML = '<p>Error loading habits. Please try again.</p>';
            archivedHabitsList.innerHTML = '<p>Error loading archived habits.</p>';
        } finally {
            activeHabitsLoading.style.display = 'none';
            archivedHabitsLoading.style.display = 'none';
        }
    }

    /**
     * Helper to get completions just for today.
     * This avoids fetching all completions every time.
     */



    // --- Event Handlers ---

    /**
     * Handles the submission of the "Add Habit" form.
     */
    async function handleAddHabitSubmit(event) {
        event.preventDefault(); // Prevent default form submission
        const formData = new FormData(addHabitForm);
        const name = formData.get('name');
        const current_weight = parseFloat(formData.get('current_weight'));

        if (!name || isNaN(current_weight)) {
            alert('Please fill in all fields correctly.');
            return;
        }

        try {
            await createHabit({ name, current_weight });
            addHabitForm.reset(); // Clear the form
            loadAllHabits(); // Reload the lists to show the new habit
        } catch (error) {
            console.error('Failed to add habit:', error);
            // Error is already alerted by api.js handleResponse
        }
    }

    /**
     * Handles clicks on the habit lists (using event delegation).
     */
    async function handleHabitListClick(event) {
        const target = event.target;
        const habitItem = target.closest('.habit-item'); // Find the parent <li>
        if (!habitItem) return;

        const habitId = parseInt(habitItem.dataset.habitId);


        if (target.classList.contains('complete-btn')) {
            // We'll add un-complete logic later. For now, it only marks as complete.
            if (habitItem.classList.contains('completed')) {
                alert("Un-completing habits is not yet supported in the UI.");
                return;
            }

            try {
                await markHabitComplete(habitId);

                // Manually update our local state
                todaysCompletions.add(habitId);

                // Now reload the habits. Because todaysCompletions is updated,
                // the re-render will show the change correctly.
                loadAllHabits();
            } catch (error) {
                console.error(`Failed to mark habit ${habitId} as complete:`, error);
            }
        } else if (target.classList.contains('archive-btn')) {
            const isArchiving = !habitItem.parentElement.id.includes('archived');
            try {
                await updateHabit(habitId, { is_archived: isArchiving });
                loadAllHabits(); // Reload both lists
            } catch (error) {
                console.error(`Failed to (un)archive habit ${habitId}:`, error);
            }
        } else if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to permanently delete this habit and all its history?')) {
                try {
                    await deleteHabit(habitId);
                    loadAllHabits(); // Reload the lists
                } catch (error) {
                    console.error(`Failed to delete habit ${habitId}:`, error);
                }
            }
        }
    }

    // --- Initial Setup ---

    // Attach event listeners
    addHabitForm.addEventListener('submit', handleAddHabitSubmit);
    activeHabitsList.addEventListener('click', handleHabitListClick);
    archivedHabitsList.addEventListener('click', handleHabitListClick);

    // Initial load of all habits when the page loads
    loadAllHabits();

});