// This file is executed in the renderer process for the web page
document.addEventListener('DOMContentLoaded', () => {
  // Display version information
  const versions = window.api.getVersions();
  document.getElementById('node-version').textContent = versions.node;
  document.getElementById('chrome-version').textContent = versions.chrome;
  document.getElementById('electron-version').textContent = versions.electron;
  
  // Load profiles
  loadProfiles();
  
  // Check cookie status
  checkCookieStatus();
  
  // Set up event listeners
  setupEventListeners();
});

// Load profiles from the database
async function loadProfiles() {
  const profileList = document.getElementById('profile-list');
  
  try {
    const profiles = await window.api.getProfiles();
    
    // Clear loading message
    profileList.innerHTML = '';
    
    if (profiles.length === 0) {
      profileList.innerHTML = `
        <div class="empty-state">
          <p>No Twitter profiles added yet.</p>
          <p>Click "Add Profile" to get started.</p>
        </div>
      `;
      return;
    }
    
    // Display each profile
    profiles.forEach(profile => {
      const profileCard = document.createElement('div');
      profileCard.className = 'profile-card';
      profileCard.dataset.id = profile.id;
      
      // Extract username from profile URL if display name is empty
      const displayName = profile.display_name || profile.username;
      
      profileCard.innerHTML = `
        <div class="profile-info">
          <div class="username">${displayName}</div>
          <div class="profile-url">${profile.profile_url}</div>
        </div>
        <div class="profile-actions">
          <button class="btn secondary download-btn">Download Media</button>
          <button class="btn danger delete-btn">Delete</button>
        </div>
      `;
      
      profileList.appendChild(profileCard);
    });
    
    // Add event listeners to the buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', handleDeleteProfile);
    });
    
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', handleDownloadMedia);
    });
    
  } catch (error) {
    console.error('Error loading profiles:', error);
    profileList.innerHTML = `
      <div class="empty-state">
        <p>Error loading profiles. Please try again.</p>
      </div>
    `;
  }
}

// Set up event listeners
function setupEventListeners() {
  // Add profile button
  const addProfileBtn = document.getElementById('add-profile-btn');
  const addProfileModal = document.getElementById('add-profile-modal');
  const closeBtn = document.querySelector('.close');
  const addProfileForm = document.getElementById('add-profile-form');
  
  addProfileBtn.addEventListener('click', () => {
    addProfileModal.style.display = 'block';
  });
  
  closeBtn.addEventListener('click', () => {
    addProfileModal.style.display = 'none';
  });
  
  window.addEventListener('click', (event) => {
    if (event.target === addProfileModal) {
      addProfileModal.style.display = 'none';
    }
  });
  
  addProfileForm.addEventListener('submit', handleAddProfile);
}

// Handle adding a new profile
async function handleAddProfile(event) {
  event.preventDefault();
  
  const profileUrlInput = document.getElementById('profile-url');
  const displayNameInput = document.getElementById('display-name');
  
  const profileUrl = profileUrlInput.value.trim();
  const displayName = displayNameInput.value.trim();
  
  // Basic validation
  if (!profileUrl) {
    alert('Please enter a Twitter profile URL');
    return;
  }
  
  // Extract username from URL
  let username = '';
  try {
    const url = new URL(profileUrl);
    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      username = pathParts[0];
    }
  } catch (error) {
    // If URL parsing fails, assume the input might be just the username
    username = profileUrl.replace('@', '');
  }
  
  if (!username) {
    alert('Could not extract username from the URL. Please check the format.');
    return;
  }
  
  try {
    await window.api.addProfile(username, profileUrl, displayName);
    
    // Reset form and close modal
    profileUrlInput.value = '';
    displayNameInput.value = '';
    document.getElementById('add-profile-modal').style.display = 'none';
    
    // Reload profiles
    loadProfiles();
  } catch (error) {
    console.error('Error adding profile:', error);
    alert('Error adding profile. The profile might already exist.');
  }
}

// Handle deleting a profile
async function handleDeleteProfile(event) {
  const profileCard = event.target.closest('.profile-card');
  const profileId = profileCard.dataset.id;
  
  if (confirm('Are you sure you want to delete this profile?')) {
    try {
      await window.api.deleteProfile(profileId);
      loadProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert('Error deleting profile. Please try again.');
    }
  }
}

// Handle downloading media (placeholder for now)
function handleDownloadMedia(event) {
  const profileCard = event.target.closest('.profile-card');
  const profileId = profileCard.dataset.id;
  const profileName = profileCard.querySelector('.username').textContent;
  
  alert(`Download functionality for ${profileName} will be implemented in a future update.`);
}

// Check cookie status
async function checkCookieStatus() {
  const cookieStatusDisplay = document.getElementById('cookie-status-display');
  
  try {
    const cookies = await window.api.getStoredCookies();
    
    if (cookies && cookies.cookie_data) {
      // Parse the cookie data
      const cookieData = JSON.parse(cookies.cookie_data);
      
      // Check if essential cookies are present
      const authToken = cookieData.find(cookie => cookie.name === 'auth_token');
      const ct0 = cookieData.find(cookie => cookie.name === 'ct0');
      
      if (authToken && ct0) {
        cookieStatusDisplay.innerHTML = `
          <div class="cookie-status-valid">
            <p><strong>✓ Twitter authentication cookies are valid</strong></p>
            <p>Last updated: ${new Date(cookies.added_date).toLocaleString()}</p>
          </div>
        `;
      } else {
        cookieStatusDisplay.innerHTML = `
          <div class="cookie-status-invalid">
            <p><strong>⚠️ Twitter authentication cookies are incomplete</strong></p>
            <p>Missing required cookies. Please import cookies again.</p>
          </div>
        `;
      }
    } else {
      cookieStatusDisplay.innerHTML = `
        <div class="cookie-status-invalid">
          <p><strong>⚠️ No Twitter authentication cookies found</strong></p>
          <p>Please import cookies from your browser or enter them manually.</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error checking cookie status:', error);
    cookieStatusDisplay.innerHTML = `
      <div class="cookie-status-invalid">
        <p><strong>⚠️ Error checking cookie status</strong></p>
        <p>Please try again later.</p>
      </div>
    `;
  }
}

// Extract cookies from browser
async function extractBrowserCookies(browserType) {
  const cookieStatusDisplay = document.getElementById('cookie-status-display');
  cookieStatusDisplay.innerHTML = `<div class="loading">Extracting cookies from ${browserType}...</div>`;
  
  try {
    const result = await window.api.getBrowserCookies(browserType);
    
    if (result.success) {
      // Show success message
      cookieStatusDisplay.innerHTML = `
        <div class="cookie-status-valid">
          <p><strong>✓ Twitter authentication cookies extracted successfully</strong></p>
          <p>${result.message}</p>
        </div>
      `;
      
      // Refresh cookie status after a short delay
      setTimeout(checkCookieStatus, 1000);
    } else {
      // Show error message
      cookieStatusDisplay.innerHTML = `
        <div class="cookie-status-invalid">
          <p><strong>⚠️ Failed to extract Twitter cookies</strong></p>
          <p>${result.message}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error extracting cookies:', error);
    cookieStatusDisplay.innerHTML = `
      <div class="cookie-status-invalid">
        <p><strong>⚠️ Error extracting cookies</strong></p>
        <p>${error.message || 'Unknown error'}</p>
      </div>
    `;
  }
}

// Handle manual cookie input
async function handleManualCookies(event) {
  event.preventDefault();
  
  const cookieDataInput = document.getElementById('cookie-data');
  const cookieData = cookieDataInput.value.trim();
  const cookieStatusDisplay = document.getElementById('cookie-status-display');
  
  if (!cookieData) {
    alert('Please enter cookie data');
    return;
  }
  
  cookieStatusDisplay.innerHTML = `<div class="loading">Saving cookies...</div>`;
  
  try {
    // Validate JSON format
    JSON.parse(cookieData);
    
    const result = await window.api.saveCookiesManually(cookieData);
    
    if (result.success) {
      // Show success message
      cookieStatusDisplay.innerHTML = `
        <div class="cookie-status-valid">
          <p><strong>✓ Twitter authentication cookies saved successfully</strong></p>
          <p>${result.message}</p>
        </div>
      `;
      
      // Clear the input
      cookieDataInput.value = '';
      
      // Refresh cookie status after a short delay
      setTimeout(checkCookieStatus, 1000);
    } else {
      // Show error message
      cookieStatusDisplay.innerHTML = `
        <div class="cookie-status-invalid">
          <p><strong>⚠️ Failed to save Twitter cookies</strong></p>
          <p>${result.message}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error saving cookies:', error);
    cookieStatusDisplay.innerHTML = `
      <div class="cookie-status-invalid">
        <p><strong>⚠️ Invalid cookie data format</strong></p>
        <p>Please enter valid JSON data.</p>
      </div>
    `;
  }
}

// Handle deleting cookies
async function handleDeleteCookies() {
  if (confirm('Are you sure you want to delete all stored cookies?')) {
    const cookieStatusDisplay = document.getElementById('cookie-status-display');
    cookieStatusDisplay.innerHTML = `<div class="loading">Deleting cookies...</div>`;
    
    try {
      const result = await window.api.deleteCookies();
      
      if (result.success) {
        // Show success message
        cookieStatusDisplay.innerHTML = `
          <div class="cookie-status-invalid">
            <p><strong>✓ Twitter authentication cookies deleted</strong></p>
            <p>${result.message}</p>
          </div>
        `;
      } else {
        // Show error message
        cookieStatusDisplay.innerHTML = `
          <div class="cookie-status-invalid">
            <p><strong>⚠️ Failed to delete Twitter cookies</strong></p>
            <p>${result.message}</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error deleting cookies:', error);
      cookieStatusDisplay.innerHTML = `
        <div class="cookie-status-invalid">
          <p><strong>⚠️ Error deleting cookies</strong></p>
          <p>${error.message || 'Unknown error'}</p>
        </div>
      `;
    }
  }
}

// Navigation
const navLinks = document.querySelectorAll('nav a');
const sections = document.querySelectorAll('.section');

navLinks.forEach(link => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    
    // Remove active class from all links
    navLinks.forEach(l => l.classList.remove('active'));
    
    // Add active class to clicked link
    link.classList.add('active');
    
    // Hide all sections
    sections.forEach(section => section.classList.add('hidden'));
    
    // Show the target section
    const targetId = link.getAttribute('href').substring(1);
    document.getElementById(targetId).classList.remove('hidden');
  });
});

// Browser cookie buttons
document.getElementById('chrome-cookies-btn').addEventListener('click', () => {
  extractBrowserCookies('chrome');
});

document.getElementById('firefox-cookies-btn').addEventListener('click', () => {
  extractBrowserCookies('firefox');
});

// Manual cookie form
document.getElementById('manual-cookie-form').addEventListener('submit', handleManualCookies);

// Delete cookies button
document.getElementById('delete-cookies-btn').addEventListener('click', handleDeleteCookies);
