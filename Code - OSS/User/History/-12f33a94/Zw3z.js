// js/task.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const addTaskForm = document.getElementById('add-task-form');
    const taskList = document.getElementById('task-list');
    const tasksLoading = document.getElementById('tasks-loading');
    const taskDateInput = document.getElementById('task-date');
    const editTaskModal = document.getElementById('edit-task-modal');
    const editTaskForm = document.getElementById('edit-task-form');
    const closeEditTaskModalBtn = document.getElementById('close-edit-task-modal');
    const editTaskIdInput = document.getElementById('edit-task-id');
    const editTaskDescriptionInput = document.getElementById('edit-task-description');
    const editTaskTargetDateInput = document.getElementById('edit-task-target-date');
    const editTaskIsAssignedInput = document.getElementById('edit-task-is-assigned');
    // --- Utility Function ---
    let originalTaskTargetDate = null;
    const getTodayString = () => new Date().toISOString().slice(0, 10);

    // --- Functions ---

    /**
     * Creates an HTML list item element for a single task.
     * @param {Object} task - The task object from the API.
     * @returns {HTMLLIElement} The created list item element.
     */
    function createTaskElement(task) {
        const li = document.createElement('li');
        li.className = 'task-item';
        li.dataset.taskId = task.id;
        if (task.is_done) {
            li.classList.add('done');
        }

        li.innerHTML = `
        <div class="task-main">
            <input type="checkbox" class="task-checkbox" ${task.is_done ? 'checked' : ''} title="Mark as done/undone">
            <span class="task-description">${task.description}</span>
        </div>
        <div class="task-details">
            ${task.is_assigned ? '<span class="task-tag assigned">Assigned</span>' : '<span class="task-tag">Not Assigned</span>'}
            <span class="task-date">${task.target_date}</span>
            <button class="edit-btn-task" title="Edit Task">✏️</button> 
            <button class="delete-btn-task" title="Delete Task">×</button>
        </div>
    `;
        return li;
    }

    /**
     * Renders a list of tasks into the task list container.
     * @param {Array<Object>} tasks - An array of task objects.
     */
    function renderTasks(tasks) {
        taskList.innerHTML = ''; // Clear previous content
        if (tasks.length === 0) {
            taskList.innerHTML = '<p>No tasks found for this day.</p>';
            return;
        }
        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskList.appendChild(taskElement);
        });
    }

    /**
     * Fetches and renders tasks for a specific date. Defaults to today.
     * @param {string} [date=today] - The date in 'YYYY-MM-DD' format.
     */
    async function loadTasks(date = getTodayString()) {
        tasksLoading.style.display = 'block';
        taskList.innerHTML = ''; // Clear list while loading

        try {
            const tasks = await fetchTasks(date);
            renderTasks(tasks);
        } catch (error) {
            console.error('Failed to load tasks:', error);
            taskList.innerHTML = '<p>Error loading tasks. Please try again.</p>';
        } finally {
            tasksLoading.style.display = 'none';
        }
    }

    function openEditTaskModal(taskData) {
        editTaskIdInput.value = taskData.id;
        editTaskDescriptionInput.value = taskData.description;
        editTaskTargetDateInput.value = taskData.targetDate; // from dataset
        editTaskIsAssignedInput.checked = taskData.isAssigned === 'true'; // dataset stores as string
        originalTaskTargetDate = taskData.targetDate; // Store the original date
        editTaskModal.style.display = 'block';
    }

    function closeEditTaskModal() {
        editTaskModal.style.display = 'none';
        editTaskForm.reset(); // Clear form for next use
        originalTaskTargetDate = null;
    }

    // --- Event Handlers ---

    /**
     * Handles the submission of the "Add Task" form.
     */
    async function handleAddTaskSubmit(event) {
        event.preventDefault();
        const formData = new FormData(addTaskForm);
        const description = formData.get('description');
        const target_date = formData.get('target_date');
        const is_assigned = formData.get('is_assigned') === 'on'; // Checkbox value is 'on' if checked

        if (!description || !target_date) {
            alert('Please provide a description and a target date.');
            return;
        }

        try {
            await createTask({ description, target_date, is_assigned });
            addTaskForm.reset(); // Clear the form
            taskDateInput.value = getTodayString(); // Reset date to today
            // Reload tasks for the date the new task was added to
            loadTasks(target_date);
            document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: target_date } }));
        } catch (error) {
            console.error('Failed to add task:', error);
        }
    }

    /**
     * Handles clicks on the task list (for completing and deleting).
     */
    async function handleTaskListClick(event) {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = parseInt(taskItem.dataset.taskId);

        // Handle checkbox click to mark task as done/undone
        if (target.classList.contains('task-checkbox')) {
            const is_done = target.checked;
            try {
                await updateTask(taskId, { is_done });
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: taskItem.querySelector('.task-date').textContent /* or fetch task details again */ } }));
                // Visually update immediately for better UX
                taskItem.classList.toggle('done', is_done);
            } catch (error) {
                console.error(`Failed to update task ${taskId}:`, error);
                // Revert checkbox on failure
                target.checked = !is_done;
            }
        }
        // Handle delete button click
        else if (target.classList.contains('delete-btn-task')) {
            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await deleteTask(taskId);
                    document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: taskItem.querySelector('.task-date').textContent } }));
                    // Visually remove the item immediately
                    taskItem.remove();
                } catch (error) {
                    console.error(`Failed to delete task ${taskId}:`, error);
                }
            }
        }
    }

    async function handleTaskListClick(event) {
        const target = event.target;
        const taskItem = target.closest('.task-item');
        if (!taskItem) return;

        const taskId = parseInt(taskItem.dataset.taskId);

        if (target.classList.contains('task-checkbox')) {
            // ... (existing checkbox logic - keep as is)
            // Remember to dispatch 'dataChanged'
            const is_done = target.checked;
            const taskDate = taskItem.dataset.targetDate; // Get date from dataset
            try {
                await updateTask(taskId, { is_done });
                taskItem.classList.toggle('done', is_done);
                taskItem.dataset.isDone = is_done.toString(); // Update dataset
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: taskDate } }));
            } catch (error) { /* ... */ }

        } else if (target.classList.contains('delete-btn-task')) {
            // ... (existing delete logic - keep as is)
            // Remember to dispatch 'dataChanged'
            const taskDate = taskItem.dataset.targetDate;
            if (confirm('Are you sure you want to delete this task?')) {
                try {
                    await deleteTask(taskId);
                    taskItem.remove();
                    document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: taskDate } }));
                } catch (error) { /* ... */ }
            }
        } else if (target.classList.contains('edit-btn-task')) { // <<< NEW EDIT LOGIC
            const taskData = {
                id: taskId,
                description: taskItem.dataset.description,
                targetDate: taskItem.dataset.targetDate,
                isAssigned: taskItem.dataset.isAssigned, // Will be "true" or "false"
                isDone: taskItem.dataset.isDone
            };
            openEditTaskModal(taskData);
        }
    }

    /**
     * Handles submission of the Edit Task form.
     */
    async function handleEditTaskSubmit(event) {
        event.preventDefault();
        const taskId = parseInt(editTaskIdInput.value);
        const description = editTaskDescriptionInput.value;
        const target_date = editTaskTargetDateInput.value;
        const is_assigned = editTaskIsAssignedInput.checked;

        if (!description || !target_date) {
            alert("Description and Target Date are required.");
            return;
        }

        const updateData = { description, target_date, is_assigned };

        try {
            await updateTask(taskId, updateData); // from api.js
            closeEditTaskModal();

            // Reload tasks for the relevant date(s)
            // If the date changed, we need to update the score for both old and new dates
            // The backend PUT /api/tasks/:id already handles recalculating for the NEW target_date.
            // We also need to ensure the old date's score is updated if tasks moved away from it.

            // Always refresh the view for the *new* target_date
            const currentDateInView = document.getElementById('task-date-filter-input')?.value || getTodayString(); // Hypothetical filter
            if (currentDateInView === target_date || currentDateInView === originalTaskTargetDate) {
                // If currently viewing one of the affected dates, reload tasks for that view
                await loadTasks(currentDateInView); // This will show changes for the current view
            } else {
                // If not viewing an affected date, just ensure the backend has recalculated.
                // The dashboard will pick up changes via dataChanged.
            }


            // Dispatch dataChanged for both dates if the date changed
            // The backend PUT /api/tasks/:id already triggers recalculateDailyScore for task.target_date
            // We need to ensure the old date is also handled if it changed.
            // The backend's recalculateDailyScore on the new date is sufficient for that day.
            // If a task moves *from* a date, that old date's task score changes.

            // Dispatch for the new date
            document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: target_date } }));
            if (originalTaskTargetDate && originalTaskTargetDate !== target_date) {
                // Dispatch for the old date as well, so its score gets re-evaluated
                // The backend doesn't automatically do this on task update if the date changes.
                // We might need a specific backend call, or rely on the frontend re-fetching.
                // For now, let's assume the backend will be enhanced later or this is sufficient.
                document.body.dispatchEvent(new CustomEvent('dataChanged', { detail: { date: originalTaskTargetDate } }));

                // To be fully correct, if a task's date changes, the backend needs to know
                // to recalculate the score for the *old* date too.
                // The current `PUT /api/tasks/:id` only recalculates for the *new* `task.target_date`.
                // This is a limitation we can address later by modifying the backend PUT endpoint.
                // For now, the frontend event will cause the dashboard to re-fetch, which gets the updated old date score.
            }


        } catch (error) {
            console.error(`Failed to update task ${taskId}:`, error);
            alert("Failed to save changes. Please try again.");
        }
    }
    // --- Initial Setup ---

    // Set the default date for the new task form to today
    taskDateInput.value = getTodayString();

    // Attach event listeners
    addTaskForm.addEventListener('submit', handleAddTaskSubmit);
    taskList.addEventListener('click', handleTaskListClick); // Ensure this is still here or updated

    // Event listeners for modal
    if (closeEditTaskModalBtn) {
        closeEditTaskModalBtn.addEventListener('click', closeEditTaskModal);
    }
    if (editTaskModal) {
        // Close modal if user clicks outside the modal content
        editTaskModal.addEventListener('click', (event) => {
            if (event.target === editTaskModal) {
                closeEditTaskModal();
            }
        });
    }
    if (editTaskForm) {
        editTaskForm.addEventListener('submit', handleEditTaskSubmit);
    }

    loadTasks(); // Initial load
});