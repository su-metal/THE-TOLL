document.addEventListener('DOMContentLoaded', async () => {
  const statusMsg = document.getElementById('status-msg');
  const radioButtons = document.querySelectorAll('input[name="duration"]');

  // Load saved setting
  const data = await chrome.storage.local.get('lock_duration_min');
  const savedDuration = data.lock_duration_min || 20;

  radioButtons.forEach(radio => {
    if (parseInt(radio.value) === savedDuration) {
      radio.checked = true;
    }

    radio.addEventListener('change', async (e) => {
      const value = parseInt(e.target.value);
      await chrome.storage.local.set({ lock_duration_min: value });
      showSavedStatus();
    });
  });

  // --- Scheduling Logic ---
  const dayChecks = document.querySelectorAll('.day-check input');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');

  // Load saved schedule
  const scheduleData = await chrome.storage.local.get('lock_schedule');
  const schedule = scheduleData.lock_schedule || { 
    days: [1, 2, 3, 4, 5], 
    start: "09:00", 
    end: "18:00" 
  };

  // Set initial states
  dayChecks.forEach(check => {
    check.checked = schedule.days.includes(parseInt(check.dataset.day));
    check.addEventListener('change', saveSchedule);
  });
  startTimeInput.value = schedule.start;
  endTimeInput.value = schedule.end;
  startTimeInput.addEventListener('change', saveSchedule);
  endTimeInput.addEventListener('change', saveSchedule);

  async function saveSchedule() {
    const activeDays = Array.from(dayChecks)
      .filter(c => c.checked)
      .map(c => parseInt(c.dataset.day));
    
    await chrome.storage.local.set({
      lock_schedule: {
        days: activeDays,
        start: startTimeInput.value,
        end: endTimeInput.value
      }
    });
    showSavedStatus();
  }

  function showSavedStatus() {
    statusMsg.className = 'visible';
    setTimeout(() => {
      statusMsg.className = '';
    }, 2000);
  }
});
