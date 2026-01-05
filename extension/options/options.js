/**
 * RAL Options Page Script
 * Fully functional settings management for service-worker.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  // =========================================================================
  // ELEMENT REFERENCES
  // =========================================================================
  
  // Master control
  const enabled = document.getElementById('enabled');
  
  // Mode selection
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const serverConfig = document.getElementById('serverConfig');
  const serverUrl = document.getElementById('serverUrl');
  const apiKey = document.getElementById('apiKey');
  const testConnection = document.getElementById('testConnection');
  const connectionResult = document.getElementById('connectionResult');
  const serverStatus = document.getElementById('serverStatus');
  
  // Temporal context options
  const includeDate = document.getElementById('includeDate');
  const includeTime = document.getElementById('includeTime');
  const includeTimezone = document.getElementById('includeTimezone');
  const includeDayPart = document.getElementById('includeDayPart');
  const includeWeekend = document.getElementById('includeWeekend');
  
  // Browser intelligence options
  const includeBrowserTabs = document.getElementById('includeBrowserTabs');
  const includeRecentActivity = document.getElementById('includeRecentActivity');
  const includeCurrentFocus = document.getElementById('includeCurrentFocus');
  const includeRelevantTabs = document.getElementById('includeRelevantTabs');
  
  // Killer features
  const includeClipboard = document.getElementById('includeClipboard');
  const includePageContent = document.getElementById('includePageContent');
  const includeUserProfile = document.getElementById('includeUserProfile');
  
  // Future context (disabled)
  const includeLocation = document.getElementById('includeLocation');
  const includeWeather = document.getElementById('includeWeather');
  const includeCalendar = document.getElementById('includeCalendar');
  
  // Advanced options
  const autoDetect = document.getElementById('autoDetect');
  const maxContextTokens = document.getElementById('maxContextTokens');
  const cacheTimeout = document.getElementById('cacheTimeout');
  
  // User profile
  const currentProject = document.getElementById('currentProject');
  const techStack = document.getElementById('techStack');
  const customContext = document.getElementById('customContext');
  
  // Task context
  const taskGoal = document.getElementById('taskGoal');
  const taskCurrentStep = document.getElementById('taskCurrentStep');
  const taskSuccessCriteria = document.getElementById('taskSuccessCriteria');
  const taskNonGoals = document.getElementById('taskNonGoals');
  
  // Stats
  const promptsEnhancedEl = document.getElementById('promptsEnhanced');
  const selectionsTrackedEl = document.getElementById('selectionsTracked');
  const lastUsedEl = document.getElementById('lastUsed');
  const resetStats = document.getElementById('resetStats');
  
  // Actions
  const saveSettings = document.getElementById('saveSettings');
  const exportSettings = document.getElementById('exportSettings');
  const importSettings = document.getElementById('importSettings');
  
  // Toast
  const toast = document.getElementById('toast');

  // =========================================================================
  // LOAD SETTINGS
  // =========================================================================
  
  async function loadSettings() {
    // Get settings from storage (same key as service-worker.js)
    const { settings, userProfile: storedProfile, selectionHistory } = await chrome.storage.local.get([
      'settings', 
      'userProfile',
      'selectionHistory'
    ]);
    
    const s = settings || {};
    const profile = storedProfile || {};
    
    // Master control
    enabled.checked = s.enabled ?? true;
    
    // Mode
    const modeRadio = document.querySelector(`input[name="mode"][value="${s.mode || 'local'}"]`);
    if (modeRadio) modeRadio.checked = true;
    updateServerConfigVisibility(s.mode || 'local');
    
    // Server config
    serverUrl.value = s.serverUrl || '';
    apiKey.value = s.apiKey || '';
    
    // Temporal context
    includeDate.checked = s.includeDate ?? true;
    includeTime.checked = s.includeTime ?? true;
    includeTimezone.checked = s.includeTimezone ?? true;
    includeDayPart.checked = s.includeDayPart ?? true;
    includeWeekend.checked = s.includeWeekend ?? true;
    
    // Browser intelligence
    includeBrowserTabs.checked = s.includeBrowserTabs ?? true;
    includeRecentActivity.checked = s.includeRecentActivity ?? true;
    includeCurrentFocus.checked = s.includeCurrentFocus ?? true;
    includeRelevantTabs.checked = s.includeRelevantTabs ?? true;
    
    // Killer features
    includeClipboard.checked = s.includeClipboard ?? true;
    includePageContent.checked = s.includePageContent ?? true;
    includeUserProfile.checked = s.includeUserProfile ?? true;
    
    // Advanced
    autoDetect.checked = s.autoDetect ?? false;
    maxContextTokens.value = s.maxContextTokens || 1000;
    cacheTimeout.value = Math.round((s.cacheTimeout || 15000) / 1000);
    
    // User profile
    currentProject.value = profile.currentProject || '';
    techStack.value = (profile.techStack || []).join(', ');
    customContext.value = profile.customContext || '';
    
    // Task context
    const task = profile.taskContext || {};
    taskGoal.value = task.goal || '';
    taskCurrentStep.value = task.currentStep || '';
    taskSuccessCriteria.value = task.successCriteria || '';
    taskNonGoals.value = task.nonGoals || '';
    
    // Stats
    promptsEnhancedEl.textContent = s.promptsEnhanced || 0;
    selectionsTrackedEl.textContent = (selectionHistory || []).length;
    lastUsedEl.textContent = s.lastUsed 
      ? formatRelativeTime(new Date(s.lastUsed))
      : 'NEVER';
    
    // Update server status display
    updateServerStatus(s);
    
    console.log('RAL Options: Settings loaded');
  }

  // =========================================================================
  // SAVE SETTINGS
  // =========================================================================
  
  async function saveAllSettings() {
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'local';
    
    // Build settings object (matches service-worker.js DEFAULT_SETTINGS structure)
    const newSettings = {
      enabled: enabled.checked,
      mode,
      
      // Temporal context
      includeDate: includeDate.checked,
      includeTime: includeTime.checked,
      includeTimezone: includeTimezone.checked,
      includeDayPart: includeDayPart.checked,
      includeWeekend: includeWeekend.checked,
      
      // Browser intelligence
      includeBrowserTabs: includeBrowserTabs.checked,
      includeRecentActivity: includeRecentActivity.checked,
      includeCurrentFocus: includeCurrentFocus.checked,
      includeRelevantTabs: includeRelevantTabs.checked,
      
      // Killer features
      includeClipboard: includeClipboard.checked,
      includePageContent: includePageContent.checked,
      includeUserProfile: includeUserProfile.checked,
      
      // Future context (keep defaults)
      includeLocation: false,
      includeWeather: false,
      includeCalendar: false,
      
      // Server config
      serverUrl: serverUrl.value.trim() || null,
      apiKey: apiKey.value.trim() || null,
      
      // Advanced
      autoDetect: autoDetect.checked,
      maxContextTokens: parseInt(maxContextTokens.value) || 1000,
      cacheTimeout: (parseInt(cacheTimeout.value) || 15) * 1000,
    };
    
    // Build user profile object
    const newProfile = {
      currentProject: currentProject.value.trim() || null,
      techStack: techStack.value.split(',').map(s => s.trim()).filter(Boolean),
      customContext: customContext.value.trim() || '',
      preferences: [],
      recentTopics: [],
      taskContext: {
        goal: taskGoal.value.trim() || '',
        currentStep: taskCurrentStep.value.trim() || '',
        successCriteria: taskSuccessCriteria.value.trim() || '',
        nonGoals: taskNonGoals.value.trim() || '',
      },
    };
    
    // Get existing settings to preserve stats
    const { settings: existing } = await chrome.storage.local.get('settings');
    
    // Save to storage (same keys as service-worker.js uses)
    await chrome.storage.local.set({
      settings: { 
        ...existing, 
        ...newSettings,
        // Preserve stats
        promptsEnhanced: existing?.promptsEnhanced || 0,
        lastUsed: existing?.lastUsed || null,
        userId: existing?.userId || null,
      },
      userProfile: newProfile,
      // Also save flat keys for popup compatibility
      enabled: newSettings.enabled,
      mode: newSettings.mode,
      includeTimezone: newSettings.includeTimezone,
      includeDate: newSettings.includeDate,
      includeTime: newSettings.includeTime,
      includeDayPart: newSettings.includeDayPart,
      includeWeekend: newSettings.includeWeekend,
      includeBrowserTabs: newSettings.includeBrowserTabs,
      includeRecentActivity: newSettings.includeRecentActivity,
      includeCurrentFocus: newSettings.includeCurrentFocus,
      includeRelevantTabs: newSettings.includeRelevantTabs,
      includeClipboard: newSettings.includeClipboard,
      includePageContent: newSettings.includePageContent,
      includeUserProfile: newSettings.includeUserProfile,
      serverUrl: newSettings.serverUrl,
      apiKey: newSettings.apiKey,
      autoDetect: newSettings.autoDetect,
    });
    
    // Also notify background script
    try {
      await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: newSettings
      });
      
      await chrome.runtime.sendMessage({
        type: 'SET_USER_PROFILE',
        profile: newProfile
      });
    } catch (e) {
      console.log('RAL Options: Background notification skipped (service worker may be idle)');
    }
    
    showToast('SETTINGS_COMMITTED!', 'success');
    updateServerStatus(newSettings);
    
    console.log('RAL Options: Settings saved', newSettings);
  }

  // =========================================================================
  // UI HELPERS
  // =========================================================================
  
  function updateServerConfigVisibility(mode) {
    if (mode === 'local') {
      serverConfig.style.display = 'none';
    } else {
      serverConfig.style.display = 'block';
    }
  }
  
  function updateServerStatus(settings) {
    const statusDot = serverStatus.querySelector('.status-dot');
    const statusText = serverStatus.querySelector('.status-text');
    
    if (!settings.enabled) {
      serverStatus.className = 'server-status disabled';
      statusText.textContent = 'RAL_DISABLED';
    } else if (settings.mode === 'local') {
      serverStatus.className = 'server-status';
      statusText.textContent = 'MODE: LOCAL';
    } else if (settings.serverUrl) {
      serverStatus.className = 'server-status connected';
      statusText.textContent = settings.mode === 'hybrid' ? 'MODE: HYBRID' : 'MODE: SERVER';
    } else {
      serverStatus.className = 'server-status warning';
      statusText.textContent = 'SERVER_NOT_CONFIGURED';
    }
  }
  
  function formatRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'JUST_NOW';
    if (diffMins < 60) return `${diffMins}M_AGO`;
    if (diffHours < 24) return `${diffHours}H_AGO`;
    if (diffDays < 7) return `${diffDays}D_AGO`;
    return date.toLocaleDateString();
  }

  // =========================================================================
  // SERVER CONNECTION TEST
  // =========================================================================
  
  async function testServerConnection() {
    const url = serverUrl.value.trim();
    if (!url) {
      showConnectionResult('ERROR: NO_URL_PROVIDED', 'error');
      return;
    }
    
    testConnection.disabled = true;
    testConnection.textContent = 'PINGING...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CHECK_SERVER',
        serverUrl: url
      });
      
      if (response?.healthy) {
        showConnectionResult(`✓ CONNECTED! VERSION: ${response.version || 'UNKNOWN'}`, 'success');
      } else {
        showConnectionResult(`✗ FAILED: ${response?.reason || 'UNKNOWN_ERROR'}`, 'error');
      }
    } catch (error) {
      showConnectionResult(`✗ ERROR: ${error.message}`, 'error');
    }
    
    testConnection.disabled = false;
    testConnection.textContent = 'PING';
  }
  
  function showConnectionResult(message, type) {
    connectionResult.textContent = message;
    connectionResult.className = `connection-result ${type}`;
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================
  
  function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // =========================================================================
  // EXPORT / IMPORT
  // =========================================================================
  
  async function exportSettingsToFile() {
    const data = await chrome.storage.local.get(['settings', 'userProfile']);
    const exportData = {
      settings: data.settings,
      userProfile: data.userProfile,
      exportedAt: new Date().toISOString(),
      version: '3.0.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `ral-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    showToast('SETTINGS_EXPORTED!', 'success');
  }
  
  async function importSettingsFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        
        if (imported.settings) {
          const { settings: existing } = await chrome.storage.local.get('settings');
          await chrome.storage.local.set({
            settings: { ...existing, ...imported.settings }
          });
        }
        
        if (imported.userProfile) {
          await chrome.storage.local.set({
            userProfile: imported.userProfile
          });
        }
        
        showToast('SETTINGS_IMPORTED!', 'success');
        loadSettings(); // Reload UI
      } catch (error) {
        showToast('INVALID_FILE_FORMAT', 'error');
        console.error('Import error:', error);
      }
    };
    
    input.click();
  }

  // =========================================================================
  // STATS RESET
  // =========================================================================
  
  async function resetStatistics() {
    try {
      await chrome.runtime.sendMessage({ type: 'RESET_STATS' });
    } catch (e) {
      // If background script is asleep, reset directly
      const { settings } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({
        settings: { ...settings, promptsEnhanced: 0, lastUsed: null }
      });
    }
    
    promptsEnhancedEl.textContent = '0';
    lastUsedEl.textContent = 'NEVER';
    showToast('STATS_RESET!', 'success');
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  
  // Mode selection
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      updateServerConfigVisibility(e.target.value);
    });
  });
  
  // Master toggle - immediate save
  enabled.addEventListener('change', async () => {
    const { settings } = await chrome.storage.local.get('settings');
    await chrome.storage.local.set({
      settings: { ...settings, enabled: enabled.checked },
      enabled: enabled.checked
    });
    updateServerStatus({ ...settings, enabled: enabled.checked });
    showToast(enabled.checked ? 'RAL_ENABLED' : 'RAL_DISABLED', 'success');
  });
  
  // Action buttons
  testConnection.addEventListener('click', testServerConnection);
  saveSettings.addEventListener('click', saveAllSettings);
  exportSettings.addEventListener('click', exportSettingsToFile);
  importSettings.addEventListener('click', importSettingsFromFile);
  resetStats.addEventListener('click', resetStatistics);

  // =========================================================================
  // INITIALIZE
  // =========================================================================
  
  await loadSettings();
  
  console.log('RAL Options: Initialized');
});
