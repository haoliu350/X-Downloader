// This file is executed in the renderer process for the web page
document.addEventListener('DOMContentLoaded', () => {
  // Display version information
  const versions = window.api.getVersions();
  document.getElementById('node-version').textContent = versions.node;
  document.getElementById('chrome-version').textContent = versions.chrome;
  document.getElementById('electron-version').textContent = versions.electron;
  
  // Load profiles
  loadProfiles();
  
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