// js/habit.js (Now for the "Manage Habits" page)

document.addEventListener('DOMContentLoaded', () => {
    // Elements specific to the habits-management-section
    const habitManagementSection = document.getElementById('habits-management-section');
    const manageHabitForm = document.getElementById('manage-habit-form');
    const manageHabitIdInput = document.getElementById('manage-habit-id');
    const manageHabitNameInput = document.getElementById('manage-habit-name');
    const manageHabitWeightInput = document.getElementById('manage-habit-weight');
    const saveManagedHabitBtn = document.getElementById('save-managed-habit-btn'); // Ensure button has this ID or type="submit"
    const clearManagedHabitFormBtn = document.getElementById('clear-managed-habit-form-btn');
    const allDefinedHabitsListEl = document.getElementById('all-defined-habits-list');
    const allHabitsLoadingEl = document.getElementById('all-habits-loading');

    let isHabitManagementInitialized = false;

    /**
     * Creates list item for the "All Defined Habits" list
     */
    function createDefinedHabitElement(habit) {
        const li = document.createElement('li');
        li.className = 'flex justify-between items-center p-3 bg-dracula-bg rounded shadow';
        li.dataset.habitId = habit.id;

        li.innerHTML = `
            <div class="flex-grow">
                <span class="font-medium ${habit.is_archived ? 'line-through text-dracula-comment' : 'text-dracula-fg'}">${habit.name}</span>
                <span class="text-xs text-dracula-comment ml-2">(W: ${habit.current_weight}) ${habit.is_archived ? '[Archived]' : ''}</span>
            </div>
            <div class="space-x-2">
                <button class="edit-defined-habit-btn btn secondary !py-1 !px-2 text-xs">Edit</button>
                <button class="archive-defined-habit-btn btn ${habit.is_archived ? 'bg-dracula-green text-dracula-bg' : 'secondary'} !py-1 !px-2 text-xs">
                    ${habit.is_archived ? 'Unarchive' : 'Archive'}
                </button>
                 <button class="delete-defined-habit-btn btn danger !py-1 !px-2 text-xs">Delete</button>
            </div>
        `;
        return li;
    }

    /**
     * Renders all defined habits (active and archived)
     */
    async function loadAndRenderAllDefinedHabits() {
        if (!allDefinedHabitsListEl || !allHabitsLoadingEl) return; // Elements not on this page

        allHabitsLoadingEl.style.display = 'block';
        allDefinedHabitsListEl.innerHTML = '';
        try {
            const [activeHabits, archivedHabits] = await Promise.all([
                fetchActiveHabits(),
                fetchArchivedHabits()
            ]);
            const allHabits = [...activeHabits, ...archivedHabits].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)); // Example sort

            if (allHabits.length === 0) {
                allDefinedHabitsListEl.innerHTML = '<p class="text-dracula-comment italic">No habits defined yet.</p>';
            } else {
                allHabits.forEach(habit => {
                    allDefinedHabitsListEl.appendChild(createDefinedHabitElement(habit));
                });
            }
        } catch (error) {
            console.error("Failed to load defined habits:", error);
            allDefinedHabitsListEl.innerHTML = '<p class="text-dracula-red">Error loading habits.</p>';
        } finally {
            allHabitsLoadingEl.style.display = 'none';
        }
    }

    /**
     * Populates the manage form for editing.
     */
    function populateManageHabitForm(habit) {
        manageHabitIdInput.value = habit.id;
        manageHabitNameInput.value = habit.name;
        manageHabitWeightInput.value = habit.current_weight;
        saveManagedHabitBtn.textContent = "Update Habit Definition";
    }

    /**
     * Clears the manage form.
     */
    function clearManageHabitForm() {
        manageHabitForm.reset();
        manageHabitIdInput.value = ''; // Clear hidden ID
        saveManagedHabitBtn.textContent = "Save Habit Definition";
        manageHabitNameInput.focus();
    }

    /**
     * Handles saving (create or update) a habit definition.
     */
    async function handleSaveManagedHabit(event) {
        event.preventDefault();
        const id = manageHabitIdInput.value ? parseInt(manageHabitIdInput.value) : null;
        const name = manageHabitNameInput.value.trim();
        const current_weight = parseFloat(manageHabitWeightInput.value);

        if (!name || isNaN(current_weight) || current_weight < 0 || current_weight > 1) {
            alert("Please provide a valid name and weight (0.0 - 1.0).");
            return;
        }

        try {
            if (id) { // Update existing habit
                await updateHabit(id, { name, current_weight });
            } else { // Create new habit
                await createHabit({ name, current_weight });
            }
            clearManageHabitForm();
            await loadAndRenderAllDefinedHabits();
            // Inform dashboard that habit definitions might have changed (e.g., for dropdowns)
            document.body.dispatchEvent(new CustomEvent('habitDefinitionsChanged'));
        } catch (error) {
            console.error("Failed to save habit definition:", error);
            alert("Error saving habit. See console for details.");
        }
    }

    /**
     * Handles actions on the "All Defined Habits" list.
     */
    async function handleDefinedHabitListActions(event) {
        const target = event.target;
        const habitItem = target.closest('li[data-habit-id]');
        if (!habitItem) return;

        const habitId = parseInt(habitItem.dataset.habitId);

        if (target.classList.contains('edit-defined-habit-btn')) {
            // Fetch the full habit object to populate the form accurately
            // (since the list might not have all details or could be stale)
            try {
                // This is inefficient; ideally, the `allHabits` array would be stored and reused.
                // For now, we re-fetch active and archived to find the habit.
                const [activeHabits, archivedHabits] = await Promise.all([fetchActiveHabits(), fetchArchivedHabits()]);
                const allHabits = [...activeHabits, ...archivedHabits];
                const habitToEdit = allHabits.find(h => h.id === habitId);
                if (habitToEdit) {
                    populateManageHabitForm(habitToEdit);
                    manageHabitNameInput.focus(); // Focus on the name input
                } else {
                    alert("Could not find habit data to edit.");
                }
            } catch (error) {
                alert("Error fetching habit details for editing.");
            }
        } else if (target.classList.contains('archive-defined-habit-btn')) {
            const isCurrentlyArchived = target.textContent.includes('Unarchive');
            try {
                await updateHabit(habitId, { is_archived: !isCurrentlyArchived });
                await loadAndRenderAllDefinedHabits();
                document.body.dispatchEvent(new CustomEvent('habitDefinitionsChanged'));
            } catch (error) {
                console.error("Failed to (un)archive habit:", error);
            }
        } else if (target.classList.contains('delete-defined-habit-btn')) {
            if (confirm('Are you sure you want to PERMANENTLY delete this habit definition and ALL its completion history? This cannot be undone.')) {
                 try {
                    await deleteHabit(habitId);
                    await loadAndRenderAllDefinedHabits();
                    document.body.dispatchEvent(new CustomEvent('habitDefinitionsChanged'));
                 } catch (error) {
                    console.error("Failed to delete habit definition:", error);
                 }
            }
        }
    }
    
    /**
     * Initializes logic for the Habit Management page.
     * This function should be exposed and called by app.js when this view is shown.
     */
    function initializeHabitManagementPage() {
        if (!habitManagementSection || habitManagementSection.style.display === 'none' || isHabitManagementInitialized) {
            // If section doesn't exist, is hidden, or already initialized, do nothing.
            // The isHabitManagementInitialized flag prevents re-attaching listeners if called multiple times
            // while the view is already visible and initialized.
            if (habitManagementSection && habitManagementSection.style.display !== 'none' && !isHabitManagementInitialized) {
                 // It's visible but not init, probably first direct load.
            } else {
                return;
            }
        }
        
        console.log("Habit Management page initialized/shown.");

        // Ensure elements exist before adding listeners or calling functions
        if (manageHabitForm) {
            manageHabitForm.addEventListener('submit', handleSaveManagedHabit);
        }
        if (clearManagedHabitFormBtn) {
            clearManagedHabitFormBtn.addEventListener('click', clearManageHabitForm);
        }
        if (allDefinedHabitsListEl) {
            allDefinedHabitsListEl.addEventListener('click', handleDefinedHabitListActions);
        }

        loadAndRenderAllDefinedHabits();
        clearManageHabitForm(); // Start with a clean form
        isHabitManagementInitialized = true;
    }
    
    // Expose the initialization function to be called by app.js
    window.habitManagementModule = {
        initializeHabitManagementPage
    };

    // Attempt to initialize if this section is already visible on page load
    // (e.g., if default view or if styles are not yet applied to hide it)
    if (habitManagementSection && habitManagementSection.offsetParent !== null) {
        initializeHabitManagementPage();
    }
});