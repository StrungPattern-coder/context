document.addEventListener('DOMContentLoaded', async () => {
  // --- Elements ---
  const connectionStatus = document.getElementById('connectionStatus');
  const gaugeValue = document.getElementById('gaugeValue');
  const gaugeLabel = document.getElementById('gaugeLabel');
  const techStackInput = document.getElementById('techStackInput');
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  const scrubberLog = document.getElementById('scrubberLog');
  const circle = document.querySelector('.progress-ring__circle');
  
  // --- State ---
  const radius = circle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  
  // Setup Ring
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  function setProgress(percent) {
    const offset = circumference - (percent / 100) * circumference;
    circle.style.strokeDashoffset = offset;
  }

  // --- Logic ---

  // 1. Load Profile
  try {
    const profile = await chrome.runtime.sendMessage({ type: 'GET_USER_PROFILE' });
    if (profile && profile.techStack) {
      techStackInput.value = profile.techStack.join(', ');
    }
  } catch (e) {
    console.log('Error loading profile:', e);
  }

  // 2. Save Profile
  saveProfileBtn.addEventListener('click', async () => {
    const stack = techStackInput.value.split(',').map(s => s.trim()).filter(s => s);
    
    // We need to preserve other profile data that isn't in this view
    try {
      const currentProfile = await chrome.runtime.sendMessage({ type: 'GET_USER_PROFILE' }) || {};
      
      await chrome.runtime.sendMessage({
        type: 'SET_USER_PROFILE',
        ...currentProfile,
        techStack: stack
      });
      
      // Visual Feedback
      const originalText = saveProfileBtn.innerHTML;
      saveProfileBtn.innerHTML = '<span>Saved</span>';
      saveProfileBtn.style.borderColor = 'var(--success)';
      setTimeout(() => {
        saveProfileBtn.innerHTML = originalText;
        saveProfileBtn.style.borderColor = '';
      }, 2000);
      
      addLog('Profile updated', 'info');
    } catch (e) {
      console.error(e);
    }
  });

  // 3. Telemetry & Status
  async function updateTelemetry() {
    try {
      const data = await chrome.runtime.sendMessage({ type: 'GET_TELEMETRY' });
      
      // Cognitive Load -> Ring
      const load = data?.telemetry?.cognitiveLoad || 'normal';
      let percent = 25;
      let label = 'Normal';
      let isFrustrated = false;

      if (load === 'FRUSTRATED') {
        percent = 85;
        label = 'Overload';
        isFrustrated = true;
      } else if (load === 'high') {
        percent = 60;
        label = 'High';
      }

      setProgress(percent);
      gaugeValue.textContent = label;
      
      // Theme Switch
      if (isFrustrated) {
        document.body.classList.add('state-frustrated');
        gaugeLabel.textContent = 'Frustration Detected';
      } else {
        document.body.classList.remove('state-frustrated');
        gaugeLabel.textContent = 'Cognitive Load';
      }

      // Tabs
      const tabs = await chrome.tabs.query({});
      const aiDomains = ['chat.openai.com', 'chatgpt.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai'];
      const nonAiTabs = tabs.filter(t => !aiDomains.some(d => t.url?.includes(d)));
      document.querySelector('#globalTabsStatus .data-value').textContent = nonAiTabs.length;

    } catch (e) {
      console.log('Telemetry error:', e);
    }

    // Battery
    if ('getBattery' in navigator) {
      try {
        const battery = await navigator.getBattery();
        const level = Math.round(battery.level * 100);
        document.querySelector('#batteryStatus .data-value').textContent = `${level}%`;
      } catch (e) {}
    }
  }

  // 4. Scrubber Log Simulation
  function addLog(msg, type = 'cmd') {
    const line = document.createElement('div');
    line.className = 'log-line';
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    line.innerHTML = `<span class="timestamp">${time}</span> <span class="${type}">${msg}</span>`;
    scrubberLog.appendChild(line);
    scrubberLog.scrollTop = scrubberLog.scrollHeight;
  }

  // Init
  updateTelemetry();
  setInterval(updateTelemetry, 5000);
  
  // Simulate some log activity
  setTimeout(() => addLog('DOM Analysis complete', 'info'), 1000);
  setTimeout(() => addLog('Context vector ready', 'cmd'), 2500);

  // Footer Links
  document.getElementById('openOptions').addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('clearData').addEventListener('click', () => {
    if(confirm('Reset all data?')) {
      chrome.storage.local.clear();
      location.reload();
    }
  });
});
