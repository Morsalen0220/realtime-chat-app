// প্রোফাইল পেজের জন্য UI এলিমেন্টস
const PROFILE_UI_ELEMENTS = {
    profileCoverPhoto: document.getElementById('profileCoverPhoto'),
    profilePageAvatar: document.getElementById('profilePageAvatar'),
    profilePageUsername: document.getElementById('profilePageUsername'),
    profilePageStatus: document.getElementById('profilePageStatus'),
    profilePageJoinedDate: document.getElementById('profilePageJoinedDate'),
    profilePageRole: document.getElementById('profilePageRole'),
    profilePageUserId: document.getElementById('profilePageUserId'), 
    myProfileEditSection: document.getElementById('myProfileEditSection'),
    profilePageStatusInput: document.getElementById('profilePageStatusInput'),
    profilePageSaveStatusBtn: document.getElementById('profilePageSaveStatusBtn'),
    avatarOptionsProfilePage: document.querySelector('.avatar-options-profile-page'),
    darkModeToggleProfilePage: document.getElementById('darkModeToggleProfilePage'),
    otherUserProfileActions: document.getElementById('otherUserProfileActions'),
    kickUserFromProfilePageBtn: document.getElementById('kickUserFromProfilePageBtn'),
    backToChatBtn: document.querySelector('.back-to-chat-btn'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    sendMessageBtn: document.getElementById('sendMessageBtn')
};

// নোটিফিকেশন ফাংশন
function showNotification(msg, type = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) return; 

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = msg;

    container.appendChild(notification);

    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (container.contains(notification)) {
                container.removeChild(notification);
            }
        }, 500);
    }, 3500);
}


async function apiRequest(endpoint, options = {}) {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        options.headers = { ...headers, ...options.headers };

        const res = await fetch(endpoint, options);
        
        const contentType = res.headers.get('content-type');
        let data;

        if (contentType && contentType.includes('application/json')) {
            data = await res.json();
        } else {
            const text = await res.text(); 
            console.error(`Non-JSON API Response from ${endpoint} (Status: ${res.status}):`, text);
            throw new Error(`Server returned non-JSON response (Status: ${res.status}). Expected JSON. Response content (first 100 chars): ${text.substring(0, 100)}`);
        }

        if (!res.ok) {
            throw new Error(data.message || `API call failed with status ${res.status}.`);
        }
        return { ok: true, data };
    } catch (error) {
        console.error('API Request Error:', error.message);
        return { ok: false, data: { message: error.message || 'সার্ভার ত্রুটি।' } };
    }
}

async function fetchUserProfile(userId) {
    try {
        const { ok, data: user } = await apiRequest(`/api/user/${userId}`, { method: 'GET' });
        if (ok) {
            if (PROFILE_UI_ELEMENTS.profileCoverPhoto) {
                PROFILE_UI_ELEMENTS.profileCoverPhoto.src = user.coverPhoto || 'images/default_cover.jpg'; 
            }
            if (PROFILE_UI_ELEMENTS.profilePageAvatar) {
                PROFILE_UI_ELEMENTS.profilePageAvatar.src = user.avatar || 'avatars/avatar1.png';
            }
            if (PROFILE_UI_ELEMENTS.profilePageUsername) {
                PROFILE_UI_ELEMENTS.profilePageUsername.textContent = user.username;
            }
            if (PROFILE_UI_ELEMENTS.profilePageStatus) {
                PROFILE_UI_ELEMENTS.profilePageStatus.textContent = user.status;
            }
            if (PROFILE_UI_ELEMENTS.profilePageJoinedDate) {
                PROFILE_UI_ELEMENTS.profilePageJoinedDate.textContent = new Date(user.createdAt).toLocaleDateString();
            }
            if (PROFILE_UI_ELEMENTS.profilePageRole) {
                PROFILE_UI_ELEMENTS.profilePageRole.textContent = user.role;
            }
            if (PROFILE_UI_ELEMENTS.profilePageUserId) { 
                PROFILE_UI_ELEMENTS.profilePageUserId.textContent = user._id;
            }
            

            const loggedInUserId = localStorage.getItem('userId');
            const loggedInUserRole = localStorage.getItem('userRole');

            if (userId === loggedInUserId) {
                if (PROFILE_UI_ELEMENTS.editProfileBtn) PROFILE_UI_ELEMENTS.editProfileBtn.style.display = 'block';
                if (PROFILE_UI_ELEMENTS.sendMessageBtn) PROFILE_UI_ELEMENTS.sendMessageBtn.style.display = 'none';
                if (PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn) PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.style.display = 'none';

                if (PROFILE_UI_ELEMENTS.profilePageStatusInput) {
                    PROFILE_UI_ELEMENTS.profilePageStatusInput.value = user.status;
                }

            } else {
                if (PROFILE_UI_ELEMENTS.editProfileBtn) PROFILE_UI_ELEMENTS.editProfileBtn.style.display = 'none';
                if (PROFILE_UI_ELEMENTS.sendMessageBtn) PROFILE_UI_ELEMENTS.sendMessageBtn.style.display = 'block';
                
                if (PROFILE_UI_ELEMENTS.myProfileEditSection) PROFILE_UI_ELEMENTS.myProfileEditSection.style.display = 'none';
                
                if ((loggedInUserRole === 'admin' || loggedInUserRole === 'moderator')) {
                    if (PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn) {
                        PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.style.display = 'block';
                        PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.dataset.targetUserId = user._id;
                        PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.dataset.targetUsername = user.username;
                    }
                } else {
                    if (PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn) PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.style.display = 'none';
                }
            }

            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
                if (PROFILE_UI_ELEMENTS.darkModeToggleProfilePage) PROFILE_UI_ELEMENTS.darkModeToggleProfilePage.checked = true;
            } else {
                document.body.classList.remove('dark-theme');
                if (PROFILE_UI_ELEMENTS.darkModeToggleProfilePage) PROFILE_UI_ELEMENTS.darkModeToggleProfilePage.checked = false;
            }

        } else {
            showNotification(user.message || 'প্রোফাইল লোড করা যায়নি।', 'error');
            if (PROFILE_UI_ELEMENTS.profilePageUsername) PROFILE_UI_ELEMENTS.profilePageUsername.textContent = 'ইউজার পাওয়া যায়নি।';
        }
    } catch (error) {
        console.error('Error fetching user profile:', error.message);
        showNotification('প্রোফাইল লোড করতে সমস্যা হয়েছে।', 'error');
        if (PROFILE_UI_ELEMENTS.profilePageUsername) PROFILE_UI_ELEMENTS.profilePageUsername.textContent = 'ত্রুটি!';
    }
}

// URL থেকে userId নেওয়া এবং ইভেন্ট লিসেনার সেটআপ করা
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id');

    if (userId) {
        fetchUserProfile(userId);
    } else {
        showNotification('কোনো ইউজার আইডি পাওয়া যায়নি।', 'error');
        if (PROFILE_UI_ELEMENTS.profilePageUsername) PROFILE_UI_ELEMENTS.profilePageUsername.textContent = 'ত্রুটি!';
    }

    if (PROFILE_UI_ELEMENTS.editProfileBtn) {
        PROFILE_UI_ELEMENTS.editProfileBtn.addEventListener('click', () => {
            if (PROFILE_UI_ELEMENTS.myProfileEditSection) {
                if (PROFILE_UI_ELEMENTS.myProfileEditSection.style.display === 'block') {
                    PROFILE_UI_ELEMENTS.myProfileEditSection.style.display = 'none';
                } else {
                    PROFILE_UI_ELEMENTS.myProfileEditSection.style.display = 'block';
                }
            }
        });
    }

    if (PROFILE_UI_ELEMENTS.avatarOptionsProfilePage) {
        PROFILE_UI_ELEMENTS.avatarOptionsProfilePage.addEventListener('click', async (e) => {
            if (e.target.classList.contains('avatar-choice-profile-page')) {
                const newAvatar = e.target.dataset.avatar;
                const { ok, data } = await apiRequest('/api/user/avatar', { method: 'POST', body: JSON.stringify({ avatar: newAvatar }) });
                if (ok) {
                    localStorage.setItem('avatar', data.avatar);
                    if (PROFILE_UI_ELEMENTS.profilePageAvatar) {
                        PROFILE_UI_ELEMENTS.profilePageAvatar.src = data.avatar;
                    }
                    const socket = io();
                    socket.emit('avatar updated', { userId: localStorage.getItem('userId'), avatar: data.avatar });

                    showNotification('অ্যাভাটার পরিবর্তিত হয়েছে!', 'success');
                } else {
                    showNotification(`অ্যাভাটার পরিবর্তন সমস্যা: ${data.message}`, 'error');
                }
            }
        });
    }

    if (PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn) {
        PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn.addEventListener('click', async () => {
            const newStatus = PROFILE_UI_ELEMENTS.profilePageStatusInput ? PROFILE_UI_ELEMENTS.profilePageStatusInput.value.trim() : '';
            if (!newStatus) return showNotification('স্ট্যাটাস খালি যাবে না।', 'error');

            if (PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn) {
                PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn.disabled = true;
                PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn.textContent = 'সেভ হচ্ছে...';
            }

            const { ok, data } = await apiRequest('/api/user/status', { method: 'POST', body: JSON.stringify({ status: newStatus }) });
            if (ok) {
                localStorage.setItem('status', data.status);
                if (PROFILE_UI_ELEMENTS.profilePageStatus) {
                    PROFILE_UI_ELEMENTS.profilePageStatus.textContent = data.status;
                }
                showNotification('স্ট্যাটাস আপডেট সফল!', 'success');
                if (PROFILE_UI_ELEMENTS.myProfileEditSection) PROFILE_UI_ELEMENTS.myProfileEditSection.style.display = 'none';
            } else {
                showNotification(`স্ট্যাটাস আপডেট সমস্যা: ${data.message}`, 'error');
            }
            if (PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn) {
                PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn.disabled = false;
                PROFILE_UI_ELEMENTS.profilePageSaveStatusBtn.textContent = 'স্ট্যাটাস সেভ করুন';
            }
        });
    }

    if (PROFILE_UI_ELEMENTS.darkModeToggleProfilePage) {
        PROFILE_UI_ELEMENTS.darkModeToggleProfilePage.addEventListener('change', (event) => {
            if (event.target.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    const socket = io(); 
    if (PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn) {
        PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.addEventListener('click', () => {
            const targetUserId = PROFILE_UI_ELEMENTS.kickUserFromProfilePageBtn.dataset.targetUserId;
            const targetUsername = PROFILE_UI_ELEMENTS.profilePageUsername ? PROFILE_UI_ELEMENTS.profilePageUsername.textContent : 'এই ইউজার'; 
            const currentRoom = localStorage.getItem('lastRoom') || 'public'; 

            if (confirm(`আপনি কি নিশ্চিত যে ${targetUsername} কে ${currentRoom} রুম থেকে বের করে দিতে চান?`)) {
                socket.emit('kick user from room', { targetUserId: targetUserId, roomCode: currentRoom });
                showNotification(`${targetUsername} কে কিক করার অনুরোধ পাঠানো হয়েছে।`, 'info');
            }
        });
    }

   // profile.js - মেসেজ পাঠান বাটন
if (PROFILE_UI_ELEMENTS.sendMessageBtn) {
    PROFILE_UI_ELEMENTS.sendMessageBtn.addEventListener('click', async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const targetUserId = urlParams.get('id'); // যাকে মেসেজ পাঠানো হচ্ছে তার আইডি
        const currentLoggedInUserId = localStorage.getItem('userId'); // বর্তমানে লগইন করা ইউজারের আইডি

        if (!currentLoggedInUserId || currentLoggedInUserId.startsWith('guest-')) {
            return showNotification('মেসেজ পাঠাতে আপনাকে রেজিস্টার্ড ইউজার হতে হবে।', 'error');
        }
        if (!targetUserId) {
            return showNotification('টার্গেট ইউজার আইডি পাওয়া যায়নি।', 'error');
        }

        // সার্ভারকে প্রাইভেট চ্যাট রুম তৈরি বা খুঁজে বের করার জন্য অনুরোধ
        const { ok, data } = await apiRequest('/api/private-chat', { method: 'POST', body: JSON.stringify({ targetUserId: targetUserId }) });

        if (ok) {
            showNotification(data.message, 'success');
            const roomCode = data.roomCode;

            // চ্যাট পেজে রিডাইরেক্ট করুন এবং সেই রুমে জয়েন করার জন্য প্রস্তুত করুন
            // আমরা URL প্যারামিটার ব্যবহার করব যাতে main.js সেই রুমে জয়েন করতে পারে।
            window.location.href = `/?room=${roomCode}`; // <--- গুরুত্বপূর্ণ পরিবর্তন

        } else {
            showNotification(data.message || 'মেসেজ পাঠানো শুরু করতে সমস্যা হয়েছে।', 'error');
        }
    });
}
    socket.on('notification', (data) => {
        showNotification(data.message, data.type);
    });
});