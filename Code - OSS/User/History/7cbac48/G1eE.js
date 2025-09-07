async function testCascadingStreak() {
    const API_BASE_URL = 'http://localhost:3000/api'; // In case it's not global in console

    // Helper to make API calls and log
    async function callApi(method, url, body = null) {
        const options = { method };
        if (body) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }
        console.log(`CALLING: ${method} ${url}`, body || '');
        const response = await fetch(url, options);
        const data = await response.json();
        if (!response.ok) {
            console.error(`API Error (${response.status}) for ${method} ${url}:`, data);
            throw new Error(data.error || `API call failed for ${url}`);
        }
        console.log(`RESPONSE from ${method} ${url}:`, data);
        return data;
    }

    // Helper to create dates
    function getDateString(baseDate, dayOffset = 0) {
        const date = new Date(baseDate);
        date.setUTCDate(date.getUTCDate() + dayOffset); // Use UTC to avoid timezone shifts
        return date.toISOString().slice(0, 10);
    }

    const baseTestDate = new Date(); // Use today as a base for unique dates
    baseTestDate.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC

    const day1Str = getDateString(baseTestDate, 0);
    const day2Str = getDateString(baseTestDate, 1);
    const day3Str = getDateString(baseTestDate, 2);

    let habitIdDay1, taskIdDay1;
    let habitIdDay2, taskIdDay2;
    let habitIdDay3, taskIdDay3;

    console.log(`--- Testing Cascading Streak ---`);
    console.log(`Day 1: ${day1Str}, Day 2: ${day2Str}, Day 3: ${day3Str}`);

    try {
        // --- SETUP PHASE: Create a 3-day streak ---
        console.log(`\n--- Setting up Day 1 (${day1Str}) to achieve streak ---`);
        let habitD1 = await callApi('POST', `${API_BASE_URL}/habits`, { name: `Habit D1`, current_weight: 1.0 });
        habitIdDay1 = habitD1.data.id;
        let taskD1 = await callApi('POST', `${API_BASE_URL}/tasks`, { description: `Task D1`, target_date: day1Str, is_assigned: true });
        taskIdDay1 = taskD1.data.id;
        await callApi('POST', `${API_BASE_URL}/timelogs`, { type: 'productive', start_time: `${day1Str}T09:00:00Z`, end_time: `${day1Str}T15:00:00Z` }); // 6 hours = 60 time points
        await callApi('POST', `${API_BASE_URL}/habits/${habitIdDay1}/complete`, { date: day1Str });
        await callApi('PUT', `${API_BASE_URL}/tasks/${taskIdDay1}`, { is_done: true });
        // Score should be (100*0.45) + (100*0.45) + (60*0.1) = 45+45+6 = 96. Streak = 1.

        console.log(`\n--- Setting up Day 2 (${day2Str}) to achieve streak ---`);
        let habitD2 = await callApi('POST', `${API_BASE_URL}/habits`, { name: `Habit D2`, current_weight: 1.0 });
        habitIdDay2 = habitD2.data.id;
        let taskD2 = await callApi('POST', `${API_BASE_URL}/tasks`, { description: `Task D2`, target_date: day2Str, is_assigned: true });
        taskIdDay2 = taskD2.data.id;
        await callApi('POST', `${API_BASE_URL}/timelogs`, { type: 'productive', start_time: `${day2Str}T09:00:00Z`, end_time: `${day2Str}T15:00:00Z` });
        await callApi('POST', `${API_BASE_URL}/habits/${habitIdDay2}/complete`, { date: day2Str });
        await callApi('PUT', `${API_BASE_URL}/tasks/${taskIdDay2}`, { is_done: true });
        // Streak should be 2.

        console.log(`\n--- Setting up Day 3 (${day3Str}) to achieve streak ---`);
        let habitD3 = await callApi('POST', `${API_BASE_URL}/habits`, { name: `Habit D3`, current_weight: 1.0 });
        habitIdDay3 = habitD3.data.id;
        let taskD3 = await callApi('POST', `${API_BASE_URL}/tasks`, { description: `Task D3`, target_date: day3Str, is_assigned: true });
        taskIdDay3 = taskD3.data.id;
        await callApi('POST', `${API_BASE_URL}/timelogs`, { type: 'productive', start_time: `${day3Str}T09:00:00Z`, end_time: `${day3Str}T15:00:00Z` });
        await callApi('POST', `${API_BASE_URL}/habits/${habitIdDay3}/complete`, { date: day3Str });
        await callApi('PUT', `${API_BASE_URL}/tasks/${taskIdDay3}`, { is_done: true });
        // Streak should be 3.

        console.log(`\n--- Checking Habit Completions for Day 1 (${day1Str}) BEFORE task modification ---`);
        await callApi('GET', `${API_BASE_URL}/habits/completions?date=${day1Str}`); // Use the new backend route

        await new Promise(resolve => setTimeout(resolve, 1500));
        let initialStreak = await callApi('GET', `${API_BASE_URL}/streak`);

        // Brief pause for backend processing
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(`INITIAL STREAK (should be 3): ${initialStreak.data.current_streak_days}`);
        if (initialStreak.data.current_streak_days !== 3) {
            console.error("FAILURE: Initial 3-day streak setup failed. Check backend logs.");
            // return; // Stop if setup failed
        }


        // --- MODIFICATION PHASE: Break the streak on Day 1 ---
        console.log(`\n--- Modifying Day 1 (${day1Str}) to break its streak contribution ---`);
        // Mark task D1 as not done. This will reduce score for Day 1 below 60.
        // This PUT should trigger recalculateDailyScore(day1Str) AND then recalculateStreaksForward(day2Str)
        await callApi('PUT', `${API_BASE_URL}/tasks/${taskIdDay1}`, { is_done: false });

        // Brief pause for backend processing (including forward recalc)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // --- VERIFICATION PHASE ---
        console.log(`\n--- Verifying scores and streaks after modification ---`);

        const scoreDay1 = await callApi('GET', `${API_BASE_URL}/daily-score/${day1Str}`);
        console.log(`Score for Day 1 (${day1Str}) after modification:`, scoreDay1.data);
        // Expected: Day 1 total score < 60, streak bonus = 0.

        const scoreDay2 = await callApi('GET', `${API_BASE_URL}/daily-score/${day2Str}`);
        console.log(`Score for Day 2 (${day2Str}) after modification:`, scoreDay2.data);
        // Expected: Day 2 should now be the start of a new streak (streak = 1), or streak 0 if its own score also dropped.
        // If Day 2 score was still >=60, its bonus would be based on a 1-day streak.

        const scoreDay3 = await callApi('GET', `${API_BASE_URL}/daily-score/${day3Str}`);
        console.log(`Score for Day 3 (${day3Str}) after modification:`, scoreDay3.data);
        // Expected: Day 3 streak would be 2 if Day 2 started a new streak.

        let finalStreak = await callApi('GET', `${API_BASE_URL}/streak`);
        console.log(`FINAL STREAK (after Day 1 modification): ${finalStreak.data.current_streak_days}`);

        // Expected final streak (if Day 2 and Day 3 still qualified independently):
        // Day 1: score < 60, streak_in_data = 0
        // Day 2: score >= 60, streak_in_data = 1 (starts new streak)
        // Day 3: score >= 60, streak_in_data = 2
        // So, final streak should be 2.
        if (finalStreak.data.current_streak_days === 2) {
            console.log("SUCCESS: Cascading streak update seems to have worked as expected!");
        } else {
            console.error(`FAILURE: Final streak is ${finalStreak.data.current_streak_days}, expected 2. Check backend logs and StreakData/DailyScores tables for ${day1Str}, ${day2Str}, ${day3Str}.`);
        }

    } catch (error) {
        console.error("Error during testCascadingStreak:", error);
    }
}

testCascadingStreak();