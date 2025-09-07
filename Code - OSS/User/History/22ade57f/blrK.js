// js/chart.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const chartStartDateInput = document.getElementById('chart-start-date');
    const chartEndDateInput = document.getElementById('chart-end-date');
    const applyDateRangeBtn = document.getElementById('apply-date-range-btn');
    const predefinedRangeButtons = document.querySelectorAll('.predefined-ranges .range-btn');

    const streakProgressChartCanvas = document.getElementById('streak-progress-chart');
    const streakChartLoadingEl = document.getElementById('streak-chart-loading');

    // Habit chart elements (we'll use these later)
    const habitSelectForChart = document.getElementById('habit-select-for-chart');
    const habitProgressChartCanvas = document.getElementById('habit-progress-chart');
    const habitChartLoadingEl = document.getElementById('habit-chart-loading');

    // Daily score breakdown elements (for later)
    const historyDateSelect = document.getElementById('history-date-select');
    const dailyScoreBreakdownDetailsEl = document.getElementById('daily-score-breakdown-details');


    // --- Chart Instances ---
    let streakChartInstance = null;
    let habitChartInstance = null; // For later
    let historyPagePopulated = false;
    // --- Utility: Date Formatting ---
    const formatDateForInput = (date) => { // Date object input
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- Default Date Range Setup ---
    function setDefaultDateRange() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 29); // Last 30 days

        chartEndDateInput.value = formatDateForInput(endDate);
        chartStartDateInput.value = formatDateForInput(startDate);
    }

    // --- Streak Progress Chart Functions ---

    /**
     * Initializes or updates the streak progress chart.
     * @param {Array<Object>} scoreData - Array of { date: 'YYYY-MM-DD', total_daily_score: number }
     */
    function renderStreakProgressChart(scoreData) {
        if (!streakProgressChartCanvas) return;
        streakChartLoadingEl.style.display = 'none';

        const labels = scoreData.map(item => item.date);
        const dataPoints = scoreData.map(item => item.total_daily_score);

        const data = {
            labels: labels,
            datasets: [{
                label: 'Total Daily Score',
                data: dataPoints,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1, // Makes the line a bit curvy
                fill: true,
                pointRadius: 3,
                pointHoverRadius: 6,
            }]
        };

        const config = {
            type: 'line',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Daily Score'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                return `Score: ${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        };

        if (streakChartInstance) {
            streakChartInstance.destroy(); // Destroy old chart before creating new one
        }
        streakChartInstance = new Chart(streakProgressChartCanvas, config);
    }

    /**
     * Fetches score history and renders the streak chart.
     */
    async function loadStreakChartData() {
        if (!chartStartDateInput.value || !chartEndDateInput.value) {
            console.warn("loadStreakChartData: Start or end date missing.");
            return;
        }
        streakChartLoadingEl.style.display = 'block';
        try {
            const startDate = chartStartDateInput.value;
            const endDate = chartEndDateInput.value;
            console.log(`Loading streak chart data for: ${startDate} to ${endDate}`);
            const scores = await fetchScoresHistory(startDate, endDate);
            renderStreakProgressChart(scores);
        } catch (error) {
            console.error("Failed to load streak chart data:", error);
            streakChartLoadingEl.style.display = 'none';
            if (streakProgressChartCanvas.getContext('2d')) { // Check if canvas context exists
                streakProgressChartCanvas.getContext('2d').fillText("Error loading chart data.", 10, 50);
            }
        }
    }

    // --- Habit Progress Chart Functions (Placeholders for now) ---
    async function populateHabitSelect() {
        // TODO: Fetch active habits and populate the dropdown
        console.log("TODO: Populate habit select dropdown");
        try {
            const habits = await fetchActiveHabits(); // from api.js
            habitSelectForChart.innerHTML = '<option value="">-- Select a Habit --</option>'; // Reset
            habits.forEach(habit => {
                const option = document.createElement('option');
                option.value = habit.id;
                option.textContent = habit.name;
                habitSelectForChart.appendChild(option);
            });
        } catch (error) {
            console.error("Failed to populate habit select:", error);
        }
    }

    async function loadHabitChartData() {
        const selectedHabitId = habitSelectForChart.value;
        if (!selectedHabitId) {
            // ... clear habit chart if needed ...
            return;
        }
        if (!chartStartDateInput.value || !chartEndDateInput.value) {
            console.warn("loadHabitChartData: Start or end date missing.");
            return;
        }
        habitChartLoadingEl.style.display = 'block';
        try {
            const startDate = chartStartDateInput.value;
            const endDate = chartEndDateInput.value;
            console.log(`Loading habit chart data for ID ${selectedHabitId}: ${startDate} to ${endDate}`);
            const historyData = await fetchHabitHistory(selectedHabitId, startDate, endDate);
            renderHabitProgressChart(historyData);
        } catch (error) {
            console.error(`Failed to load data for habit ${selectedHabitId}:`, error);
            habitChartLoadingEl.style.display = 'none';
        }
    }

    function renderHabitProgressChart(historyData) {
        // TODO: Implement rendering for habit chart (e.g., bar chart or line chart of completions)
        if (!habitProgressChartCanvas) return;
        habitChartLoadingEl.style.display = 'none';
        console.log("Rendering habit progress chart with data:", historyData);

        const labels = historyData.map(item => item.date);
        // Example: use weight_at_completion for a bar chart, or 1 for completed, 0 for not
        const dataPoints = historyData.map(item => item.completed ? (item.weight_at_completion || 0.1) : 0); // Use weight or a small value for completion

        const data = {
            labels: labels,
            datasets: [{
                label: `Habit Completion (${habitSelectForChart.options[habitSelectForChart.selectedIndex].text})`,
                data: dataPoints,
                backgroundColor: 'rgba(54, 162, 235, 0.5)', // Blue
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }]
        };
        const config = {
            type: 'bar', // Or 'line'
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: { display: true, text: 'Completion Metric (e.g., Weight)' }
                    }
                }
            }
        };
        if (habitChartInstance) habitChartInstance.destroy();
        habitChartInstance = new Chart(habitProgressChartCanvas, config);
    }

    // --- Daily Score Breakdown (Placeholder for now) ---
    async function loadDailyScoreDetails() {
        const selectedDate = historyDateSelect.value;
        if (!selectedDate) {
            dailyScoreBreakdownDetailsEl.innerHTML = '<p>Select a date to see its score breakdown.</p>';
            return;
        }
        dailyScoreBreakdownDetailsEl.innerHTML = `<p>Loading details for ${selectedDate}...</p>`;
        try {
            const scoreData = await fetchDailyScore(selectedDate); // from api.js
            if (scoreData) {
                dailyScoreBreakdownDetailsEl.innerHTML = `
                    <h4>Score Details for ${scoreData.date}</h4>
                    <p><strong>Total Score: ${scoreData.total_daily_score.toFixed(2)}</strong></p>
                    <ul>
                        <li>Habit Component: ${scoreData.habit_score_component.toFixed(2)}</li>
                        <li>Task Component: ${scoreData.task_score_component.toFixed(2)}</li>
                        <li>Time Component: ${scoreData.time_score_component.toFixed(2)}</li>
                        <li>Streak Bonus: ${scoreData.streak_bonus_component.toFixed(2)}</li>
                    </ul>
                `;
            } else {
                dailyScoreBreakdownDetailsEl.innerHTML = `<p>No score data found for ${selectedDate}.</p>`;
            }
        } catch (error) {
            console.error("Failed to load daily score details:", error);
            dailyScoreBreakdownDetailsEl.innerHTML = `<p>Error loading score details for ${selectedDate}.</p>`;
        }
    }

    // --- Event Listeners ---
    applyDateRangeBtn.addEventListener('click', () => {
        loadStreakChartData();
        loadHabitChartData(); // Also update habit chart if a habit is selected
    });

    predefinedRangeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const range = button.dataset.range;
            const endDate = new Date();
            let startDate = new Date();

            switch (range) {
                case '7days':
                    startDate.setDate(endDate.getDate() - 6);
                    break;
                case '30days':
                    startDate.setDate(endDate.getDate() - 29);
                    break;
                case 'currentMonth':
                    startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                    break;
                case 'currentYear':
                    startDate = new Date(endDate.getFullYear(), 0, 1);
                    break;
            }
            chartStartDateInput.value = formatDate(startDate);
            chartEndDateInput.value = formatDate(endDate);
            // Automatically apply the new range
            loadStreakChartData();
            loadHabitChartData();
        });
    });

    habitSelectForChart.addEventListener('change', loadHabitChartData);
    historyDateSelect.addEventListener('change', loadDailyScoreDetails);


    // --- Initialization when History View is Shown ---
    // We need a way to know when the history tab becomes active.
    // For now, let's assume app.js will call an init function.
    // Or, we can use a MutationObserver if app.js just changes style.display

    function initializeHistoryPage() {
        console.log("History page initialized/shown.");
        if (!document.getElementById('history-section').dataset.chartPageInitialized) {
            setDefaultDateRange();
            populateHabitSelect(); // Populate habit dropdown
            document.getElementById('history-section').dataset.chartPageInitialized = 'true';
        }

        // Use a small delay to allow DOM to settle before drawing charts
        setTimeout(() => {
            loadStreakChartData();
            loadHabitChartData();
        }, 150); // Increased delay slightly
        loadDailyScoreDetails();
    }

    // This is a simple way to detect if the history section becomes visible.
    // A more robust solution might involve app.js calling initializeHistoryPage() directly.
    const historySection = document.getElementById('history-section');
    if (historySection) {
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
                    if (historySection.style.display !== 'none' && !historySection.dataset.initialized) {
                        initializeHistoryPage();
                        historySection.dataset.initialized = 'true'; // Prevent multiple initializations
                    } else if (historySection.style.display === 'none') {
                        historySection.dataset.initialized = ''; // Reset if hidden, so it re-initializes if shown again
                    }
                }
            }
        });
        observer.observe(historySection, { attributes: true });
    }

    // If the history section is visible on initial page load (not typical with our setup), initialize it.
    if (historySection && historySection.offsetParent !== null) { // A way to check if it's visible
        if (!historySection.dataset.initialized) {
            initializeHistoryPage();
            historySection.dataset.initialized = 'true';
        }
    }
});