// js/habit.js

// This file handles all the UI logic for the Habits section.
// It uses functions from api.js to interact with the backend.

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const addHabitForm = document.getElementById('add-habit-form');
    const activeHabitsList = document.getElementById('active-habits-list');
    const archivedHabitsList = document.getElementById('archived-habits-list');
    const activeHabitsLoading = document.getElementById('active-habits-loading');
    const archivedHabitsLoading = document.getElementById('archived-habits-loading');

    // --- State ---
    // This Set will store the IDs of habits that have been completed today.
    // It's populated when the page loads and updated when the user takes action.
    let todaysCompletions = new Set();

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

        const isCompletedToday = todaysCompletions.has(habit.id);
        if (isCompletedToday) {
            li.classList.add('completed');
        }

        const isArchived = habit.is_archived;

        li.innerHTML = `
            <div class="habit-info">
                <span class="habit-name">${habit.name}</span>
                <span class="habit-weight">(Weight: ${habit.current_weight})</span>
            </div>
            <div class="habit-actions">
                ${!isArchived ? `<button class="complete-btn">${isCompletedToday ? 'Undo' : 'Complete'}</button>` : ''}
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
     * Fetches all necessary data (habits and today's completions) and redraws the UI.
     */
    async function loadAllHabits() {
        activeHabitsLoading.style.display = 'block';
        archivedHabitsLoading.style.display = 'block';

        try {
            const today = new Date().toISOString().slice(0, 10);
            
            // Fetch everything in parallel for performance
            const [activeHabits, archivedHabits, completionsForToday] = await Promise.all([
                fetchActiveHabits(),
                fetchArchivedHabits(),
                fetchHabitCompletionsForDate(today) // Use the new, efficient API function
            ]);
            
            // Update our local state with the latest completion data from the server
            todaysCompletions = new Set(completionsForToday.map(c => c.habit_id));

            // Render the lists using the fresh data
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
            await loadAllHabits(); // Reload the lists to show the new habit
            document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: new Date().toISOString().slice(0, 10) } }));
        } catch (error) {
            console.error('Failed to add habit:', error);
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
            // Note: Our backend currently only supports *adding* a completion.
            // A full 'Undo' would require a DELETE endpoint for a specific completion.
            if (habitItem.classList.contains('completed')) {
                alert("Un-completing habits is not yet supported.");
                return;
            }
            try {
                await markHabitComplete(habitId);
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: getTodayString() } }));
                await loadAllHabits();
            } catch (error) {
                console.error(`Failed to mark habit ${habitId} as complete:`, error);
            }
        } else if (target.classList.contains('archive-btn')) {
            const isArchiving = !habitItem.parentElement.id.includes('archived');
            try {
                await updateHabit(habitId, { is_archived: isArchiving });
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: getTodayString() } }));
                await loadAllHabits(); // Reload both lists
            } catch (error) {
                console.error(`Failed to (un)archive habit ${habitId}:`, error);
            }
        } else if (target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to permanently delete this habit and all its history?')) {
                try {
                    await deleteHabit(habitId);
                    document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: getTodayString() /* or the date the habit was for if relevant for score */ } }));
                    await loadAllHabits(); // Reload the lists
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