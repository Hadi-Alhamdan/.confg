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

    // --- Initial Setup ---

    // Set the default date for the new task form to today
    taskDateInput.value = getTodayString();

    // Attach event listeners
    addTaskForm.addEventListener('submit', handleAddTaskSubmit);
    taskList.addEventListener('click', handleTaskListClick);

    // Initial load of tasks for today
    loadTasks();
});