
// DOM elements
const profileCoverPhoto = document.getElementById('profileCoverPhoto');
const profilePageAvatar = document.getElementById('profilePageAvatar');
const profilePageUsername = document.getElementById('profilePageUsername');
const profilePageStatus = document.getElementById('profilePageStatus');
const profilePageJoinedDate = document.getElementById('profilePageJoinedDate');
const profilePageRole = document.getElementById('profilePageRole');
const profilePageUserId = document.getElementById('profilePageUserId');
const editProfileBtn = document.getElementById('editProfileBtn');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const kickUserFromProfilePageBtn = document.getElementById('kickUserFromProfilePageBtn');
const myProfileEditSection = document.getElementById('myProfileEditSection');
const avatarChoices = document.querySelector('.avatar-choices');
const profilePageStatusInput = document.getElementById('profilePageStatusInput');
const profilePageSaveStatusBtn = document.getElementById('profilePageSaveStatusBtn');
const darkModeToggleProfilePage = document.getElementById('darkModeToggleProfilePage');
const notificationContainer = document.getElementById('notification-container');

// Show notifications
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 500);
    }, 3000);
}

// Fetch user profile data
async function fetchUserProfile(userId) {
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();

        if (response.ok) {
            profilePageAvatar.src = user.avatar || 'avatars/avatar1.png';
            profilePageUsername.textContent = user.username;
            profilePageStatus.textContent = user.status || 'No status yet.';
            profilePageJoinedDate.textContent = new Date(user.createdAt).toLocaleDateString();
            profilePageRole.textContent = user.role;
            profilePageUserId.textContent = user._id;

            const loggedInUserId = localStorage.getItem('userId');
            const loggedInUserRole = localStorage.getItem('userRole');

            if (userId === loggedInUserId) {
                editProfileBtn.style.display = 'block';
                sendMessageBtn.style.display = 'none';
                kickUserFromProfilePageBtn.style.display = 'none';
            } else {
                editProfileBtn.style.display = 'none';
                sendMessageBtn.style.display = 'block';
                if (loggedInUserRole === 'admin' || loggedInUserRole === 'moderator') {
                    kickUserFromProfilePageBtn.style.display = 'block';
                }
            }
        } else {
            showNotification(user.message, 'error');
        }
    } catch (error) {
        showNotification('Error fetching user profile.', 'error');
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');
    if (userId) {
        fetchUserProfile(userId);
    } else {
        showNotification('User ID not found in URL.', 'error');
    }

    editProfileBtn.addEventListener('click', () => {
        myProfileEditSection.style.display = myProfileEditSection.style.display === 'none' ? 'block' : 'none';
    });

    avatarChoices.addEventListener('click', async (e) => {
        if (e.target.tagName === 'IMG') {
            const newAvatar = e.target.dataset.avatar;
            try {
                const response = await fetch('/api/user/avatar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({ avatar: newAvatar })
                });
                const data = await response.json();
                if (response.ok) {
                    profilePageAvatar.src = newAvatar;
                    localStorage.setItem('avatar', newAvatar);
                    showNotification('Avatar updated successfully!');
                } else {
                    showNotification(data.message, 'error');
                }
            } catch (error) {
                showNotification('Error updating avatar.', 'error');
            }
        }
    });

    profilePageSaveStatusBtn.addEventListener('click', async () => {
        const newStatus = profilePageStatusInput.value;
        try {
            const response = await fetch('/api/user/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            const data = await response.json();
            if (response.ok) {
                profilePageStatus.textContent = newStatus;
                localStorage.setItem('status', newStatus);
                showNotification('Status updated successfully!');
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            showNotification('Error updating status.', 'error');
        }
    });

    darkModeToggleProfilePage.addEventListener('change', () => {
        if (darkModeToggleProfilePage.checked) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    });

    // Set initial dark mode state
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-theme');
        darkModeToggleProfilePage.checked = true;
    }
});
