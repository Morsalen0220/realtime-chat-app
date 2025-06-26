// নোটিফিকেশন দেখানোর জন্য একটি হেল্পার ফাংশন
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


const socket = io();

const UI_ELEMENTS = {
    authOverlay: document.getElementById('auth-overlay'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    showRegister: document.getElementById('showRegister'),
    showLogin: document.getElementById('showLogin'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'), // Corrected: This was 'loginUsername'
    loginBtn: document.getElementById('loginBtn'),
    registerUsername: document.getElementById('registerUsername'),
    registerPassword: document.getElementById('registerPassword'),
    registerBtn: document.getElementById('registerBtn'),
    guestBtn: document.getElementById('guestBtn'),
    authTitle: document.getElementById('auth-title'),
    mainChatContent: document.getElementById('main-chat-content'),
    showRoomsBtn: document.getElementById('showRoomsBtn'),
    currentRoomDisplayTop: document.getElementById('currentRoomDisplayTop'),
    loggedInUserInfo: document.getElementById('loggedInUserInfo'),
    logoutBtn: document.getElementById('logoutBtn'),
    clearChatBtn: document.getElementById('clearChatBtn'),
    roomSelectionButtons: document.getElementById('room-selection-buttons'),
    publicChatBtn: document.getElementById('publicChatBtn'),
    privateChatBtn: document.getElementById('privateChatBtn'),
    privateCodeSection: document.getElementById('private-code-section'),
    roomCodeInput: document.getElementById('roomCodeInput'),
    joinPrivateRoomBtn: document.getElementById('joinPrivateRoomBtn'),
    createPrivateRoomBtn: document.getElementById('createPrivateRoomBtn'),
    form: document.getElementById('form'),
    input: document.getElementById('input'),
    messages: document.getElementById('messages'),
    roomsModal: document.getElementById('rooms-modal'),
    closeButton: document.querySelector('#rooms-modal .close-button'),
    savedRoomsList: document.getElementById('saved-rooms-list'),
    onlineUsersList: document.getElementById('online-users-list'),
    typingIndicator: document.getElementById('typing-indicator'),
    hamburgerMenu: document.getElementById('hamburger-menu'),
    menuOverlay: document.getElementById('menu-overlay'),
    sidebar: document.getElementById('sidebar'),
    profileModal: document.getElementById('profile-modal'),
    profileModalCloseBtn: document.querySelector('#profile-modal .close-button'),
    avatarOptions: document.querySelector('.avatar-options'),
    userProfileInfo: document.getElementById('user-profile-info'),
    userAvatarTop: document.getElementById('user-avatar-top'),
    statusInput: document.getElementById('status-input'),
    saveStatusBtn: document.getElementById('save-status-btn'),
    viewProfileModal: document.getElementById('view-profile-modal'),
    viewProfileModalCloseBtn: document.querySelector('#view-profile-modal .close-button'),
    profileViewAvatar: document.getElementById('profile-view-avatar'),
    profileViewUsername: document.getElementById('profile-view-username'),
    profileViewStatus: document.getElementById('profile-view-status'),
    
    deleteConfirmationModal: document.getElementById('delete-confirmation-modal'),
    deleteModalCloseButton: document.getElementById('deleteModalCloseButton'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
    registerAsUserBtn: document.getElementById('registerAsUserBtn'),
    onlineUsersCountDisplay: document.getElementById('onlineUsersCountDisplay'),
    messagesLoader: document.getElementById('messages-loader'),
    darkModeToggle: document.getElementById('darkModeToggle'),
    ephemeralToggleBtn: document.getElementById('ephemeralToggleBtn'),
    ephemeralDurationModal: document.getElementById('ephemeral-duration-modal'),
    ephemeralModalCloseButton: document.getElementById('ephemeralModalCloseButton'),
    durationChoices: document.querySelector('#ephemeral-duration-modal .duration-options')
};

let username = '';
let currentRoom = '';
let userType = 'guest'; // This will be updated on auth
let hasMoreMessages = true;
let fetchingOlderMessages = false;
let lastFetchedMessageId = null;
let isEphemeralModeActive = false;
let selectedEphemeralDuration = null;


const emojiBtn = document.getElementById('emoji-btn');
const messageInput = document.getElementById('input'); 

if (emojiBtn && messageInput) {
    const picker = new EmojiButton({
        position: 'top-start', 
        theme: 'auto', 
        showSearch: true, 
        showRecents: true, 
        showVariants: true 
    });

    picker.on('emoji', emoji => {
        messageInput.value += emoji; 
        messageInput.focus(); 
    });

    emojiBtn.addEventListener('click', () => {
        picker.showPicker(emojiBtn); 
    });
}


function setUIState(state) {
    UI_ELEMENTS.authOverlay.style.display = 'none';
    UI_ELEMENTS.mainChatContent.style.display = 'none';
    if (state === 'login') {
        UI_ELEMENTS.authOverlay.style.display = 'flex';
        UI_ELEMENTS.loginForm.style.display = 'block';
        UI_ELEMENTS.registerForm.style.display = 'none';
        UI_ELEMENTS.authTitle.textContent = 'লগইন করুন';
        UI_ELEMENTS.guestBtn.style.display = 'block';
    } else if (state === 'register') {
        UI_ELEMENTS.authOverlay.style.display = 'flex';
        UI_ELEMENTS.loginForm.style.display = 'none';
        UI_ELEMENTS.registerForm.style.display = 'block';
        UI_ELEMENTS.authTitle.textContent = 'রেজিস্টার করুন';
        UI_ELEMENTS.guestBtn.style.display = 'none';
    } else if (state === 'chat') {
        UI_ELEMENTS.mainChatContent.style.display = 'flex';
        // Ensure username is updated for display
        UI_ELEMENTS.loggedInUserInfo.textContent = `${localStorage.getItem('username') || 'Guest'}`;

        // Control visibility of logout/register buttons based on current userType
        const currentUserType = localStorage.getItem('userType');
        if (UI_ELEMENTS.logoutBtn) UI_ELEMENTS.logoutBtn.style.display = currentUserType === 'registered' ? 'block' : 'none';
        if (UI_ELEMENTS.registerAsUserBtn) UI_ELEMENTS.registerAsUserBtn.style.display = currentUserType === 'guest' ? 'block' : 'none';

        const avatar = localStorage.getItem('avatar');
        if (avatar && UI_ELEMENTS.userAvatarTop) UI_ELEMENTS.userAvatarTop.src = avatar;
    }
}

async function apiRequest(endpoint, body) {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'কিছু সমস্যা হয়েছে'); 
        return { ok: true, data };
    } catch (error) {
        // Log the actual API error to console for debugging
        console.error('API Request Error:', error);
        return { ok: false, data: { message: error.message || 'সার্ভার ত্রুটি।' } };
    }
}

function handleAuthSuccess(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userType', data.type || 'registered'); // Ensure userType is set correctly
    localStorage.setItem('avatar', data.avatar);
    if (data.status) localStorage.setItem('status', data.status);
    if (data.role) localStorage.setItem('userRole', data.role);
    authenticateSocket(); // Re-authenticate socket with new token/userType
}

if (UI_ELEMENTS.showRegister) UI_ELEMENTS.showRegister.addEventListener('click', (e) => { e.preventDefault(); setUIState('register'); });
if (UI_ELEMENTS.showLogin) UI_ELEMENTS.showLogin.addEventListener('click', (e) => { e.preventDefault(); setUIState('login'); });

if (UI_ELEMENTS.loginBtn) UI_ELEMENTS.loginBtn.addEventListener('click', async () => {
    const body = { 
        username: UI_ELEMENTS.loginUsername.value.trim(), 
        password: UI_ELEMENTS.loginPassword.value.trim() 
    };

    if (!body.username || !body.password) {
        return showNotification('অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।', 'error'); 
    }

    // নতুন ভ্যালিডেশন যোগ করুন
    if (body.password.length < 6) {
        // লগইনের ক্ষেত্রে এই মেসেজটি কিছুটা ভিন্ন হতে পারে, যেমন "ইউজারনেম বা পাসওয়ার্ড ভুল।"
        // কারণ আপনি ইউজারকে পাসওয়ার্ডের দৈর্ঘ্য সরাসরি জানাতে চান না নিরাপত্তার জন্য।
        // তবে যদি শুধু minlength ভ্যালিডেশন এর জন্য হয়, তাহলে নিচের মেসেজ ঠিক আছে।
        return showNotification('ইউজারনেম অথবা পাসওয়ার্ড ভুল।', 'error'); 
    }

    const { ok, data } = await apiRequest('/api/login', body);
    if (ok) { showNotification(data.message, 'success'); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});
if (UI_ELEMENTS.registerBtn) UI_ELEMENTS.registerBtn.addEventListener('click', async () => {
    const body = { 
        username: UI_ELEMENTS.registerUsername.value.trim(), 
        password: UI_ELEMENTS.registerPassword.value.trim() 
    };

    if (!body.username || !body.password) {
        return showNotification('অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।', 'error'); 
    }

    // নতুন ভ্যালিডেশন যোগ করুন
    if (body.password.length < 6) {
        return showNotification('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'error');
    }

    const { ok, data } = await apiRequest('/api/register', body);
    if (ok) { showNotification(data.message, 'success'); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});

if (UI_ELEMENTS.guestBtn) UI_ELEMENTS.guestBtn.addEventListener('click', () => {
    // Clear token if exists, to ensure guest mode
    localStorage.removeItem('token'); 
    localStorage.removeItem('userRole'); // Clear role for guest
    
    // Ensure a guestId exists, or create a new one
    let guestId = localStorage.getItem('userId');
    let userTypeFromStorage = localStorage.getItem('userType');

    // If existing userId is not a guest or no userId, generate new guestId
    if (!guestId || !guestId.startsWith('guest-') || userTypeFromStorage !== 'guest') {
        guestId = `guest-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('userId', guestId);
        localStorage.setItem('username', `Guest-${guestId.substring(6, 10)}`);
        localStorage.setItem('avatar', 'avatars/avatar1.png');
        localStorage.setItem('userType', 'guest');
        localStorage.setItem('status', 'আমি একজন অতিথি ব্যবহারকারী।');
        localStorage.setItem('userRole', 'user'); // Default role for guests
    }

    authenticateSocket(guestId);
});

if (UI_ELEMENTS.logoutBtn) UI_ELEMENTS.logoutBtn.addEventListener('click', () => {
    // Clear all user-specific data from localStorage
    ['token', 'username', 'userId', 'userType', 'lastRoom', 'savedPrivateCode', 'savedRooms', 'avatar', 'status', 'userRole'].forEach(key => localStorage.removeItem(key));
    
    // Disconnect and reconnect socket to ensure fresh state
    socket.disconnect().connect(); 
    
    showNotification('লগআউট সফল।', 'success'); 
    setUIState('login'); // Redirect to login/auth screen
});

if (UI_ELEMENTS.registerAsUserBtn) UI_ELEMENTS.registerAsUserBtn.addEventListener('click', () => {
    // Clear existing user data to allow fresh registration
    localStorage.removeItem('token'); 
    localStorage.removeItem('userId'); 
    localStorage.removeItem('userType'); 
    localStorage.removeItem('userRole'); 
    localStorage.removeItem('username');
    localStorage.removeItem('avatar');
    localStorage.removeItem('status');

    setUIState('register'); // Go to register form
    showNotification('আপনার তথ্য দিয়ে রেজিস্টার করুন।', 'info'); 
});


if (UI_ELEMENTS.clearChatBtn) UI_ELEMENTS.clearChatBtn.addEventListener('click', () => {
    if (confirm('আপনি কি নিশ্চিত যে এই রুমের সব মেসেজ মুছে ফেলতে চান? এই কাজটি শুধুমাত্র অ্যাডমিন বা মডারেটররা করতে পারবে।')) { 
        socket.emit('clear room chat', { roomCode: currentRoom });
    }
});

if (UI_ELEMENTS.userProfileInfo) UI_ELEMENTS.userProfileInfo.addEventListener('click', () => {
    UI_ELEMENTS.statusInput.value = localStorage.getItem('status') || '';
    if (UI_ELEMENTS.profileModal) UI_ELEMENTS.profileModal.style.display = 'flex';
});

if (UI_ELEMENTS.profileModalCloseBtn) UI_ELEMENTS.profileModalCloseBtn.addEventListener('click', () => {
    if (UI_ELEMENTS.profileModal) UI_ELEMENTS.profileModal.style.display = 'none';
});

if (UI_ELEMENTS.avatarOptions) UI_ELEMENTS.avatarOptions.addEventListener('click', async (e) => {
    if (e.target.classList.contains('avatar-choice')) {
        const newAvatar = e.target.dataset.avatar;
        // Check if user is registered before allowing avatar change
        if (localStorage.getItem('userType') !== 'registered') {
            showNotification('অ্যাভাটার পরিবর্তন করতে হলে আপনাকে রেজিস্টার করতে হবে।', 'error');
            return;
        }

        const { ok, data } = await apiRequest('/api/user/avatar', { avatar: newAvatar });
        if (ok) {
            localStorage.setItem('avatar', data.avatar);
            if (UI_ELEMENTS.userAvatarTop) UI_ELEMENTS.userAvatarTop.src = data.avatar;
            showNotification('অ্যাভাটার পরিবর্তিত হয়েছে!', 'success'); 
        } else {
            showNotification(`অ্যাভাটার পরিবর্তন সমস্যা: ${data.message}`, 'error'); 
        }
    }
});

if (UI_ELEMENTS.saveStatusBtn) UI_ELEMENTS.saveStatusBtn.addEventListener('click', async () => {
    const newStatus = UI_ELEMENTS.statusInput.value.trim();
    if (!newStatus) return showNotification('স্ট্যাটাস খালি যাবে না।', 'error'); 
    
    // Check if user is registered before allowing status change
    if (localStorage.getItem('userType') !== 'registered') {
        showNotification('স্ট্যাটাস পরিবর্তন করতে হলে আপনাকে রেজিস্টার করতে হবে।', 'error');
        return;
    }

    if (UI_ELEMENTS.saveStatusBtn) {
        UI_ELEMENTS.saveStatusBtn.disabled = true;
        UI_ELEMENTS.saveStatusBtn.textContent = 'সেভ হচ্ছে...'; 
    }
    const { ok, data } = await apiRequest('/api/user/status', { status: newStatus });
    if (ok) {
        localStorage.setItem('status', data.status);
        showNotification('স্ট্যাটাস আপডেট সফল!', 'success'); 
        if (UI_ELEMENTS.profileModal) UI_ELEMENTS.profileModal.style.display = 'none';
    } else {
        showNotification(`স্ট্যাটাস আপডেট সমস্যা: ${data.message}`, 'error'); 
    }
    if (UI_ELEMENTS.saveStatusBtn) {
        UI_ELEMENTS.saveStatusBtn.disabled = false;
        UI_ELEMENTS.saveStatusBtn.textContent = 'সেভ করুন';
    }
});

// displayMessage ফাংশন
function displayMessage(data, prepend = false) {
    const item = document.createElement('li');
    item.dataset.messageId = data._id;

    const currentUserId = localStorage.getItem('userId');
    const currentUserRole = localStorage.getItem('userRole') || 'user'; // Get current user's role

    item.classList.add('message');
    if (data.userId === currentUserId) {
        item.classList.add('mine'); 
    } else {
        item.classList.add('theirs'); 
    }

    if (data.isEphemeral) {
        item.classList.add('ephemeral');
    }

    let statusIconHTML = '';
    if (data.userId === currentUserId) { 
        if (data.status === 'sent') {
            statusIconHTML = '<i class="fas fa-check" style="color:#6b7280; font-size:0.75em; margin-left:5px;" title="Sent"></i>';
        } else if (data.status === 'delivered') {
            statusIconHTML = '<i class="fas fa-check-double" style="color:#6b7280; font-size:0.75em; margin-left:5px;" title="Delivered"></i>';
        } else if (data.status === 'read') {
            statusIconHTML = '<i class="fas fa-check-double" style="color:#3b82f6; font-size:0.75em; margin-left:5px;" title="Read"></i>';
        }
    }

    let buttonsHTML = ''; // Declared once
    // Show edit/delete buttons if it's my message OR if I am admin/moderator and message is not deleted
    if (data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।' && 
       (data.userId === currentUserId || currentUserRole === 'admin' || currentUserRole === 'moderator')) {
        buttonsHTML = `<div class="message-actions"><button class="edit-btn" title="সম্পাদনা">✏️</button><button class="delete-btn" title="মুছুন">🗑️</button></div>`; 
    }
    const editedIndicator = data.isEdited && data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।' ? `<small class="edited-indicator">(সম্পাদিত)</small>` : ''; 
    const reactionsHTML = `<div class="message-reactions"></div>`;
    const reactionPaletteHTML = `<div class="reaction-palette" style="display: none;"><button class="reaction-choice" data-emoji="😄">😄</button><button class="reaction-choice" data-emoji="😐">😐</button><button class="reaction-choice" data-emoji="😢">😢</button></div>`;
    
    item.innerHTML = `
        <img src="${data.avatar || 'avatars/avatar1.png'}" class="chat-avatar" data-user-id="${data.userId}">
        <div class="message-content">
            <div>
                <b>${data.username}:</b> 
                <span class="message-text">${data.message}</span>
                ${editedIndicator}
            </div>
            ${reactionsHTML}
            ${reactionPaletteHTML}
            <small class="timestamp">
                ${data.timestamp}
                ${statusIconHTML} </small>
        </div>
        ${buttonsHTML}
    `;

    if (UI_ELEMENTS.messages) {
        if (prepend) {
            UI_ELEMENTS.messages.prepend(item);
        } else {
            UI_ELEMENTS.messages.appendChild(item);
        }
    }
    
    if (data.userId !== currentUserId && data.status !== 'read') { 
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    if (socket && socket.emit) {
                        socket.emit('message read', { messageId: data._id, room: currentRoom });
                    }
                    observer.disconnect();
                }
            });
        }, { threshold: 0.8 });
        observer.observe(item);
    }

    if (data.reactions && data.reactions.length > 0) {
        renderReactions(item, data.reactions);
    }
    
    if (!prepend && UI_ELEMENTS.messages && UI_ELEMENTS.messages.scrollTop + UI_ELEMENTS.messages.clientHeight >= UI_ELEMENTS.messages.scrollHeight - 150) {
        UI_ELEMENTS.messages.scrollTop = UI_ELEMENTS.messages.scrollHeight;
    }
}

function joinRoom(roomName) {
    currentRoom = roomName;
    if (UI_ELEMENTS.currentRoomDisplayTop) {
        UI_ELEMENTS.currentRoomDisplayTop.textContent = `আপনি ${currentRoom === 'public' ? 'পাবলিক চ্যাটে' : currentRoom + ' রুমে'} আছেন`;
    }
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.innerHTML = '';
    }
    socket.emit('join room', currentRoom);
    localStorage.setItem('lastRoom', roomName);
    if (roomName !== 'public') {
        localStorage.setItem('savedPrivateCode', roomName);
        addRoomToSavedList(roomName);
    }
    if (UI_ELEMENTS.roomsModal) {
        UI_ELEMENTS.roomsModal.style.display = 'none';
    }

    if (UI_ELEMENTS.privateCodeSection) {
        UI_ELEMENTS.privateCodeSection.style.display = 'none';
    }
    if (UI_ELEMENTS.privateChatBtn) {
        UI_ELEMENTS.privateChatBtn.classList.remove('active'); 
    }
    if (UI_ELEMENTS.publicChatBtn) {
        UI_ELEMENTS.publicChatBtn.classList.remove('active'); 
    }
    
    if (roomName === 'public' && UI_ELEMENTS.publicChatBtn) {
        UI_ELEMENTS.publicChatBtn.classList.add('active');
    } else if (roomName !== 'public' && UI_ELEMENTS.privateChatBtn) { 
        UI_ELEMENTS.privateChatBtn.classList.add('active');
    }
    hasMoreMessages = true;
}

function addRoomToSavedList(roomCode) {
    let savedRooms = JSON.parse(localStorage.getItem('savedRooms') || '[]');
    if (!savedRooms.includes(roomCode) && roomCode !== 'public') {
        savedRooms.push(roomCode);
        localStorage.setItem('savedRooms', JSON.stringify(savedRooms));
        renderSavedRooms();
    }
}

function renderSavedRooms() {
    const savedRooms = JSON.parse(localStorage.getItem('savedRooms') || '[]');
    if (UI_ELEMENTS.savedRoomsList) {
        UI_ELEMENTS.savedRoomsList.innerHTML = '';
        ['public', ...savedRooms.filter(r => r !== 'public')].forEach(room => {
            const li = document.createElement('li');
            li.textContent = room === 'public' ? 'পাবলিক' : room; 
            li.addEventListener('click', () => joinRoom(room));
            UI_ELEMENTS.savedRoomsList.appendChild(li);
        });
    }
}

function authenticateSocket(guestId = null) {
    socket.emit('authenticate', { token: localStorage.getItem('token'), guestId }, (res) => {
        if (res.success) {
            username = res.username;
            userType = res.type; // This determines 'registered' or 'guest'
            localStorage.setItem('userId', res.userId);
            localStorage.setItem('username', res.username);
            localStorage.setItem('userType', res.type); // Crucial for UI state
            if (res.avatar) localStorage.setItem('avatar', res.avatar);
            if (res.status) localStorage.setItem('status', res.status);
            if (res.role) localStorage.setItem('userRole', res.role);

            console.log("Authenticated as:", { username: res.username, type: res.type, userId: res.userId, role: res.role }); // Debug log
            
            setUIState('chat');
            // Always join public on fresh auth/login to avoid previous private room redirection issue
            joinRoom('public'); 
            renderSavedRooms();
        } else {
            // If authentication fails, ensure clean state and show login
            console.error("Authentication failed:", res.message); // Debug log
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userType');
            localStorage.removeItem('avatar');
            localStorage.removeItem('status');
            localStorage.removeItem('userRole');
            
            // If it failed and was trying to authenticate as a registered user, ensure guest state is set
            if (!guestId) { // Only generate new guest ID if not already trying to be a specific guest
                const newGuestId = `guest-${Math.random().toString(36).substring(2, 9)}`;
                localStorage.setItem('userId', newGuestId);
                localStorage.setItem('username', `Guest-${newGuestId.substring(6, 10)}`);
                localStorage.setItem('userType', 'guest');
                localStorage.setItem('avatar', 'avatars/avatar1.png');
                localStorage.setItem('status', 'আমি একজন অতিথি ব্যবহারকারী।');
                localStorage.setItem('userRole', 'user');
            }
            
            showNotification(res.message || 'সেশন মেয়াদোত্তীর্ণ। অনুগ্রহ করে আবার লগইন করুন বা অতিথি হিসেবে প্রবেশ করুন।', 'error');
            setUIState('login');
        }
    });
}

window.addEventListener('load', () => {
    // Initial load logic: check for existing session
    const token = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');
    const storedUserType = localStorage.getItem('userType'); // Get userType from localStorage

    // Set global userType based on localStorage for correct UI rendering on load
    userType = storedUserType; 

    if (token && storedUserType === 'registered') {
        authenticateSocket();
    } else if (storedUserId && storedUserType === 'guest') {
        authenticateSocket(storedUserId);
    } else {
        // If no valid session, ensure guest state is initialized for a fresh start
        const newGuestId = `guest-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('userId', newGuestId);
        localStorage.setItem('username', `Guest-${newGuestId.substring(6, 10)}`);
        localStorage.setItem('userType', 'guest');
        localStorage.setItem('avatar', 'avatars/avatar1.png');
        localStorage.setItem('status', 'আমি একজন অতিথি ব্যবহারকারী।');
        localStorage.setItem('userRole', 'user');
        userType = 'guest'; // Update global userType
        authenticateSocket(newGuestId); // Authenticate as new guest
    }

    if (UI_ELEMENTS.onlineUsersList) {
        UI_ELEMENTS.onlineUsersList.addEventListener('click', (e) => {
            const targetUserElement = e.target.closest('.online-user');
            if (targetUserElement) {
                const userId = targetUserElement.dataset.userId;
                // Profile view logic
                if (e.target.classList.contains('online-user-avatar') || e.target.classList.contains('online-username-text')) {
                    if (typeof userId === 'string' && (userId.length === 24 || userId.startsWith('guest-'))) {
                        showUserProfile(userId);
                    } else {
                        console.warn('ভুল ইউজার আইডি:', userId); 
                    }
                }
            }

            // Kick user button logic
            if (e.target.classList.contains('kick-user-btn')) {
                const targetUserId = e.target.dataset.userId;
                const targetUsername = e.target.dataset.username;
                if (confirm(`আপনি কি নিশ্চিত যে ${targetUsername} কে বর্তমান রুম থেকে বের করে দিতে চান?`)) {
                    socket.emit('kick user from room', { targetUserId: targetUserId, roomCode: currentRoom });
                }
            }
        });
    } else {
        console.error("ইউজার লিস্ট পাওয়া যায়নি।"); 
    }

    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.addEventListener('scroll', () => {
            if (UI_ELEMENTS.messages.scrollTop === 0 && hasMoreMessages && !fetchingOlderMessages) {
                fetchOlderMessages();
            }
        });
    }

    if (UI_ELEMENTS.darkModeToggle) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            UI_ELEMENTS.darkModeToggle.checked = true;
        } else {
            // Optional: check system preference if no saved theme
            // if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            //     document.body.classList.add('dark-theme');
            //     UI_ELEMENTS.darkModeToggle.checked = true;
            //     localStorage.setItem('theme', 'dark');
            // }
        }

        UI_ELEMENTS.darkModeToggle.addEventListener('change', (event) => {
            if (event.target.checked) {
                document.body.classList.add('dark-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.remove('dark-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    if (UI_ELEMENTS.ephemeralToggleBtn) {
        UI_ELEMENTS.ephemeralToggleBtn.addEventListener('click', () => {
            UI_ELEMENTS.ephemeralDurationModal.style.display = 'flex';
        });
    }

    if (UI_ELEMENTS.ephemeralModalCloseButton) {
        UI_ELEMENTS.ephemeralModalCloseButton.addEventListener('click', () => {
            UI_ELEMENTS.ephemeralDurationModal.style.display = 'none';
        });
    }

    if (UI_ELEMENTS.durationChoices) {
        UI_ELEMENTS.durationChoices.addEventListener('click', (e) => {
            if (e.target.classList.contains('duration-choice')) {
                selectedEphemeralDuration = parseInt(e.target.dataset.duration);
                if (selectedEphemeralDuration > 0) {
                    isEphemeralModeActive = true;
                    UI_ELEMENTS.ephemeralToggleBtn.classList.add('active');
                    showNotification(`গোপন মোড সক্রিয়: ${e.target.textContent} পর মেসেজ মুছে যাবে।`, 'info');
                } else {
                    isEphemeralModeActive = false;
                    UI_ELEMENTS.ephemeralToggleBtn.classList.remove('active');
                    showNotification('গোপন মোড নিষ্ক্রিয় করা হয়েছে।', 'info');
                }
                UI_ELEMENTS.ephemeralDurationModal.style.display = 'none';
            }
        });
    }
});

async function fetchOlderMessages() {
    if (!hasMoreMessages || fetchingOlderMessages) return;

    fetchingOlderMessages = true;
    if (UI_ELEMENTS.messagesLoader) {
        UI_ELEMENTS.messagesLoader.style.display = 'flex';
        UI_ELEMENTS.messagesLoader.textContent = 'লোড হচ্ছে...';
    }
    
    const firstMessageElement = UI_ELEMENTS.messages.querySelector('.message');
    lastFetchedMessageId = firstMessageElement ? firstMessageElement.dataset.messageId : null;

    console.log(`Fetching older messages for room: ${currentRoom}, before: ${lastFetchedMessageId}`);
    socket.emit('fetch older messages', { roomCode: currentRoom, lastMessageId: lastFetchedMessageId });
}


socket.on('older messages', ({ messages, hasMore }) => {
    console.log(`Received ${messages.length} older messages. Has more: ${hasMore}`);
    if (UI_ELEMENTS.messagesLoader) {
        UI_ELEMENTS.messagesLoader.style.display = 'none';
    }
    fetchingOlderMessages = false;
    hasMoreMessages = hasMore;

    if (messages.length === 0 && UI_ELEMENTS.messagesLoader) {
        UI_ELEMENTS.messagesLoader.style.display = 'block';
        UI_ELEMENTS.messagesLoader.textContent = 'আর কোনো পুরোনো মেসেজ নেই।';
        setTimeout(() => {
            if (UI_ELEMENTS.messagesLoader) UI_ELEMENTS.messagesLoader.style.display = 'none';
            if (UI_ELEMENTS.messagesLoader) UI_ELEMENTS.messagesLoader.textContent = 'লোড হচ্ছে...';
        }, 3000);
        return;
    }

    const oldScrollHeight = UI_ELEMENTS.messages.scrollHeight;
    messages.forEach(msg => displayMessage(msg, true));
    
    const newScrollHeight = UI_ELEMENTS.messages.scrollHeight;
    UI_ELEMENTS.messages.scrollTop = newScrollHeight - oldScrollHeight;
});


if (UI_ELEMENTS.publicChatBtn) UI_ELEMENTS.publicChatBtn.addEventListener('click', () => {
    UI_ELEMENTS.publicChatBtn.classList.add('active');
    if (UI_ELEMENTS.privateChatBtn) UI_ELEMENTS.privateChatBtn.classList.remove('active');
    if (UI_ELEMENTS.privateCodeSection) UI_ELEMENTS.privateCodeSection.style.display = 'none';
    joinRoom('public');
});

if (UI_ELEMENTS.privateChatBtn) UI_ELEMENTS.privateChatBtn.addEventListener('click', () => {
    UI_ELEMENTS.privateChatBtn.classList.add('active');
    if (UI_ELEMENTS.publicChatBtn) UI_ELEMENTS.publicChatBtn.classList.remove('active');
    if (UI_ELEMENTS.privateCodeSection) UI_ELEMENTS.privateCodeSection.style.display = 'flex';
});

if (UI_ELEMENTS.joinPrivateRoomBtn) UI_ELEMENTS.joinPrivateRoomBtn.addEventListener('click', () => {
    console.log('[ক্লায়েন্ট] "প্রবেশ" বাটন ক্লিক হয়েছে।'); 
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) {
        showNotification('প্রাইভেট কোড লিখুন!', 'error');
        console.log('[ক্লায়েন্ট] প্রাইভেট কোড খালি।'); 
        return;
    }
    console.log(`[ক্লায়েন্ট] 'check room existence' ইভেন্ট পাঠাচ্ছে: ${privateCode}`); 
    socket.emit('check room existence', privateCode, (exists) => {
        console.log(`[ক্লায়েন্ট] 'check room existence' থেকে রেসপন্স: ${exists}`); 
        if (exists) {
            joinRoom(privateCode);
            console.log(`[ক্লায়েন্ট] রুমে যোগ দিচ্ছে: ${privateCode}`); 
        } else {
            showNotification('রুমটি নেই। নতুন তৈরি করুন।', 'error');
            console.log(`[ক্লায়েন্ট] রুম বিদ্যমান নেই: ${privateCode}`); 
        }
    });
});

if (UI_ELEMENTS.createPrivateRoomBtn) UI_ELEMENTS.createPrivateRoomBtn.addEventListener('click', () => {
    console.log('[ক্লায়েন্ট] "তৈরি" বাটন ক্লিক হয়েছে।'); 
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) {
        showNotification('প্রাইভেট কোড লিখুন!', 'error');
        console.log('[ক্লায়েন্ট] প্রাইভেট কোড খালি।'); 
        return;
    }
    console.log(`[ক্লায়েন্ট] 'create private room' ইভেন্ট পাঠাচ্ছে: ${privateCode}`); 
    socket.emit('create private room', privateCode, username, (response) => {
        console.log(`[ক্লায়েন্ট] 'create private room' থেকে রেসপন্স: ${JSON.stringify(response)}`); 
        if (response.success) {
            joinRoom(privateCode);
            showNotification(response.message, 'success'); // Added success type
            console.log(`[ক্লায়েন্ট] রুম সফলভাবে তৈরি হয়েছে ও যোগ দিয়েছে: ${privateCode}`); 
        } else {
            showNotification(response.message || 'রুম তৈরি সমস্যা।', 'error');
            console.log(`[ক্লায়েন্ট] রুম তৈরি ব্যর্থ হয়েছে: ${response.message}`); 
        }
    });
});

if (UI_ELEMENTS.form) UI_ELEMENTS.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = UI_ELEMENTS.input.value.trim();
    if (message) {
        socket.emit('chat message', {
            message,
            room: currentRoom,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isEphemeral: isEphemeralModeActive,
            ephemeralDuration: selectedEphemeralDuration
        });
        if (UI_ELEMENTS.input) UI_ELEMENTS.input.value = '';
    }
});

function renderReactions(messageElement, reactions) {
    const reactionsContainer = messageElement.querySelector('.message-reactions');
    if (!reactionsContainer) return;
    reactionsContainer.innerHTML = '';
    if (!reactions || reactions.length === 0) return;
    const groupedReactions = reactions.reduce((acc, reaction) => {
        acc[reaction.emoji] = (acc[reaction.emoji] || 0) + 1;
        return acc;
    }, {});
    for (const emoji in groupedReactions) {
        const count = groupedReactions[emoji]; 
        const reactionBtn = document.createElement('button');
        reactionBtn.className = 'reaction-display';
        reactionBtn.textContent = `${emoji} ${count}`;
        reactionsContainer.appendChild(reactionBtn);
    }
}

if (UI_ELEMENTS.messages) UI_ELEMENTS.messages.addEventListener('click', (e) => {
    const messageContent = e.target.closest('.message-content');
    const messageLi = e.target.closest('li[data-message-id]');
    
    if (messageContent && !e.target.classList.contains('reaction-choice') && !e.target.closest('.message-actions')) {
        const palette = messageContent.querySelector('.reaction-palette');
        if (palette) {
            document.querySelectorAll('.reaction-palette').forEach(p => {
                if (p !== palette) p.style.display = 'none';
            });
            palette.style.display = palette.style.display === 'none' ? 'flex' : 'none';
        }
    }
    
    if (e.target.classList.contains('reaction-choice')) {
        const messageId = messageLi.dataset.messageId;
        const emoji = e.target.dataset.emoji;
        socket.emit('message reaction', { messageId, emoji });
        const palette = e.target.closest('.reaction-palette');
        if (palette) palette.style.display = 'none';
        return;
    }
    if (!messageLi) return;
    const messageId = messageLi.dataset.messageId;
    
    if (UI_ELEMENTS.confirmDeleteBtn && UI_ELEMENTS.deleteConfirmationModal && e.target.classList.contains('delete-btn')) {
        UI_ELEMENTS.confirmDeleteBtn.dataset.messageId = messageId;
        UI_ELEMENTS.deleteConfirmationModal.style.display = 'flex'; 
    } else if (e.target.classList.contains('edit-btn')) {
        const textElem = messageLi.querySelector('.message-text');
        const newText = prompt('মেসেজ সম্পাদনা করুন:', textElem.textContent); 
        if (newText && newText.trim() !== '' && newText !== textElem.textContent) {
            socket.emit('edit message', { messageId, newMessageText: newText });
        }
    }
});

if (UI_ELEMENTS.deleteModalCloseButton) {
    UI_ELEMENTS.deleteModalCloseButton.addEventListener('click', () => {
        if (UI_ELEMENTS.deleteConfirmationModal) UI_ELEMENTS.deleteConfirmationModal.style.display = 'none';
    });
} else {
    console.warn("মুছুন মোডাল বন্ধ বাটন পাওয়া যায়নি।"); 
}

if (UI_ELEMENTS.cancelDeleteBtn) {
    UI_ELEMENTS.cancelDeleteBtn.addEventListener('click', () => {
        if (UI_ELEMENTS.deleteConfirmationModal) UI_ELEMENTS.deleteConfirmationModal.style.display = 'none';
    });
} else {
    console.warn("মুছুন মোডাল বাতিল বাটন পাওয়া যায়নি।"); 
}

if (UI_ELEMENTS.confirmDeleteBtn) {
    UI_ELEMENTS.confirmDeleteBtn.addEventListener('click', () => {
        const messageIdToDelete = UI_ELEMENTS.confirmDeleteBtn.dataset.messageId;
        if (messageIdToDelete) {
            socket.emit('delete message', { messageId: messageIdToDelete });
            if (UI_ELEMENTS.deleteConfirmationModal) UI_ELEMENTS.deleteConfirmationModal.style.display = 'none'; 
        }
    });
} else {
    console.warn("মুছুন মোডাল নিশ্চিত বাটন পাওয়া যায়নি।"); 
}


async function showUserProfile(userId) {
    if (!userId) return;
    if (UI_ELEMENTS.viewProfileModal) UI_ELEMENTS.viewProfileModal.style.display = 'flex';
    if (UI_ELEMENTS.profileViewUsername) UI_ELEMENTS.profileViewUsername.textContent = 'লোড হচ্ছে...'; 
    if (UI_ELEMENTS.profileViewStatus) UI_ELEMENTS.profileViewStatus.textContent = '';
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();
        if (response.ok) {
            if (UI_ELEMENTS.profileViewAvatar) UI_ELEMENTS.profileViewAvatar.src = user.avatar;
            if (UI_ELEMENTS.profileViewUsername) UI_ELEMENTS.profileViewUsername.textContent = user.username;
            if (UI_ELEMENTS.profileViewStatus) UI_ELEMENTS.profileViewStatus.textContent = user.status;
            // You might want to display user role here as well
            // if (UI_ELEMENTS.profileViewRole) UI_ELEMENTS.profileViewRole.textContent = `Role: ${user.role}`;
        } else {
            if (UI_ELEMENTS.profileViewUsername) UI_ELEMENTS.profileViewUsername.textContent = 'ইউজার নেই।'; 
        }
    } catch (error) {
        if (UI_ELEMENTS.profileViewUsername) UI_ELEMENTS.profileViewUsername.textContent = 'ত্রুটি!'; 
        console.error('প্রোফাইল লোড সমস্যা:', error); 
    }
}

let typingIndicatorTimer;
if (UI_ELEMENTS.input) UI_ELEMENTS.input.addEventListener('input', () => socket.emit('typing', { room: currentRoom }));

socket.on('user typing', ({ username: typingUsername }) => {
    if (typingUsername !== username && UI_ELEMENTS.typingIndicator) {
        UI_ELEMENTS.typingIndicator.textContent = `${typingUsername} লিখছে...`; 
        clearTimeout(typingIndicatorTimer);
        typingIndicatorTimer = setTimeout(() => { UI_ELEMENTS.typingIndicator.textContent = ''; }, 3000);
    }
});

socket.on('online users list', (users) => {
    // Filter unique users by userId
    const uniqueUsers = [...new Map(users.map(item => [item.userId, item])).values()];
    const currentUserRole = localStorage.getItem('userRole') || 'user';
    const currentLoggedInUserId = localStorage.getItem('userId');

    const listHtml = uniqueUsers.map(user => {
        let kickButton = '';
        // Only show kick button if current user is admin/moderator AND not kicking self
        if ((currentUserRole === 'admin' || currentUserRole === 'moderator') && user.userId !== currentLoggedInUserId) {
            kickButton = `<button class="kick-user-btn" data-user-id="${user.userId}" data-username="${user.username}" title="ব্যবহারকারীকে বের করে দিন">Kick</button>`;
        }
        return `<li class="online-user" data-user-id="${user.userId}">
                    <img src="${user.avatar}" class="online-user-avatar" data-user-id="${user.userId}">
                    <span class="online-status-dot"></span> 
                    <span class="online-username-text">${user.username}</span> 
                    ${kickButton}
                </li>`;
    }).join('');
    if (UI_ELEMENTS.onlineUsersList) {
        UI_ELEMENTS.onlineUsersList.innerHTML = listHtml;
    }
    
    if (UI_ELEMENTS.onlineUsersCountDisplay) {
        UI_ELEMENTS.onlineUsersCountDisplay.textContent = `${uniqueUsers.length} অনলাইন`; 
    }
});

socket.on('previous messages', (msgs) => {
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.innerHTML = '';
        msgs.forEach(msg => displayMessage(msg, false));
    }
});

socket.on('chat message', displayMessage);

socket.on('user joined', (msg) => {
    const item = document.createElement('li');
    item.classList.add('message', 'system'); 
    item.innerHTML = `<i>${msg}</i>`;
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.appendChild(item);
        // Scroll to bottom when a new system message appears
        UI_ELEMENTS.messages.scrollTop = UI_ELEMENTS.messages.scrollHeight;
    }
});

socket.on('message edited', ({ messageId, newMessageText }) => {
    const msgLi = document.querySelector(`li[data-message-id="${messageId}"]`);
    if (msgLi) {
        const textElem = msgLi.querySelector('.message-text');
        if (textElem) textElem.textContent = newMessageText;
        if (newMessageText === 'এই মেসেজটি মুছে ফেলা হয়েছে।') { 
            const messageActions = msgLi.querySelector('.message-actions');
            if (messageActions) messageActions.remove();
        }
        if (!msgLi.querySelector('.edited-indicator') && newMessageText !== 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
            const indicator = document.createElement('small');
            indicator.className = 'edited-indicator';
            indicator.textContent = ' (সম্পাদিত)'; 
            textElem.insertAdjacentElement('afterend', indicator);
        } else if (newMessageText === 'এই মেসেজটি মুছে ফেলা হয়েছে.') { // Ensure exact match for removal
            const indicator = msgLi.querySelector('.edited-indicator');
            if (indicator) indicator.remove();
        }
    }
});

socket.on('chat cleared', () => {
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.innerHTML = '';
        const item = document.createElement('li');
        item.classList.add('system-message');
        item.innerHTML = `<i>চ্যাট পরিষ্কার করা হলো।</i>`; 
        if (UI_ELEMENTS.messages) UI_ELEMENTS.messages.appendChild(item);
        // Scroll to bottom after clearing chat
        UI_ELEMENTS.messages.scrollTop = UI_ELEMENTS.messages.scrollHeight;
    }
});

socket.on('message status updated', ({ messageId, status }) => {
    console.log(`[ক্লায়েন্ট] মেসেজ স্ট্যাটাস আপডেট ইভেন্ট পাওয়া গেছে (ID: ${messageId}, স্ট্যাটাস: ${status})`); 

    const messageLi = document.querySelector(`li[data-message-id="${messageId}"]`);
    if (messageLi) {
        const timestampSpan = messageLi.querySelector('.timestamp');
        if (timestampSpan) {
            let iconClass = '';
            let iconColor = '';
            let iconTitle = '';

            if (status === 'sent') {
                iconClass = 'fas fa-check';
                iconColor = '#6b7280';
                iconTitle = 'Sent';
            } else if (status === 'delivered') {
                iconClass = 'fas fa-check-double';
                iconColor = '#6b7280';
                iconTitle = 'Delivered';
            } else if (status === 'read') {
                iconClass = 'fas fa-check-double';
                iconColor = '#3b82f6';
                iconTitle = 'Read';
            }
            
            const newIconHTML = `<i class="${iconClass}" style="color:${iconColor}; font-size:0.75em; margin-left:5px;" title="${iconTitle}"></i>`;
            
            const existingIcon = timestampSpan.querySelector('.fas');
            if (existingIcon) {
                existingIcon.className = iconClass;
                existingIcon.style.color = iconColor;
                existingIcon.title = iconTitle;
            } else {
                timestampSpan.innerHTML += newIconHTML;
            }
        }
    }
});


socket.on('avatar updated', ({ userId, avatar }) => {
    document.querySelectorAll(`img.chat-avatar[data-user-id="${userId}"]`).forEach(img => {
        img.src = avatar;
    });
    if (localStorage.getItem('userId') === userId && UI_ELEMENTS.userAvatarTop) {
        UI_ELEMENTS.userAvatarTop.src = avatar;
    }
});

socket.on('reactions updated', ({ messageId, reactions }) => {
    const messageLi = document.querySelector(`li[data-message-id="${messageId}"]`);
    if (messageLi) {
        renderReactions(messageLi, reactions);
    }
});

socket.on('user kicked', ({ roomCode, message }) => {
    showNotification(message, 'error');
    if (currentRoom === roomCode) {
        joinRoom('public'); // If kicked from current room, go to public
    }
});

socket.on('error', (message) => { showNotification(message, 'error'); setUIState('login'); });

if (UI_ELEMENTS.showRoomsBtn) UI_ELEMENTS.showRoomsBtn.addEventListener('click', () => { 
    if (UI_ELEMENTS.roomsModal) UI_ELEMENTS.roomsModal.style.display = 'flex'; 
});
if (UI_ELEMENTS.closeButton) UI_ELEMENTS.closeButton.addEventListener('click', () => { 
    if (UI_ELEMENTS.roomsModal) UI_ELEMENTS.roomsModal.style.display = 'none'; 
});
window.addEventListener('click', (event) => {
    if (UI_ELEMENTS.roomsModal && event.target === UI_ELEMENTS.roomsModal) UI_ELEMENTS.roomsModal.style.display = 'none';
    if (UI_ELEMENTS.deleteConfirmationModal && event.target === UI_ELEMENTS.deleteConfirmationModal) {
        UI_ELEMENTS.deleteConfirmationModal.style.display = 'none'; 
    }
    if (UI_ELEMENTS.viewProfileModal && event.target === UI_ELEMENTS.viewProfileModal) {
        UI_ELEMENTS.viewProfileModal.style.display = 'none';
    }
    if (UI_ELEMENTS.ephemeralDurationModal && event.target === UI_ELEMENTS.ephemeralDurationModal) {
        UI_ELEMENTS.ephemeralDurationModal.style.display = 'none';
    }
});

if (UI_ELEMENTS.hamburgerMenu) UI_ELEMENTS.hamburgerMenu.addEventListener('click', () => {
    if (UI_ELEMENTS.sidebar) UI_ELEMENTS.sidebar.classList.add('sidebar-open');
    if (UI_ELEMENTS.menuOverlay) UI_ELEMENTS.menuOverlay.style.display = 'block';
});
if (UI_ELEMENTS.onlineUsersCountDisplay) UI_ELEMENTS.onlineUsersCountDisplay.addEventListener('click', () => {
    if (UI_ELEMENTS.sidebar) UI_ELEMENTS.sidebar.classList.add('sidebar-open');
    if (UI_ELEMENTS.menuOverlay) UI_ELEMENTS.menuOverlay.style.display = 'block';
});
if (UI_ELEMENTS.menuOverlay) UI_ELEMENTS.menuOverlay.addEventListener('click', () => {
    if (UI_ELEMENTS.sidebar) UI_ELEMENTS.sidebar.classList.remove('sidebar-open');
    if (UI_ELEMENTS.menuOverlay) UI_ELEMENTS.menuOverlay.style.display = 'none';
});

if (UI_ELEMENTS.viewProfileModalCloseBtn) UI_ELEMENTS.viewProfileModalCloseBtn.addEventListener('click', () => {
    if (UI_ELEMENTS.viewProfileModal) UI_ELEMENTS.viewProfileModal.style.display = 'none';
});