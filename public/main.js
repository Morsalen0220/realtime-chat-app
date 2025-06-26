// নোটিফিকেশন দেখানোর জন্য একটি হেল্পার ফাংশন
function showNotification(msg, type = 'success') { // msg (মেসেজ) সংক্ষেপে
    const container = document.getElementById('notification-container');
    if (!container) return; 

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = msg; // msg ব্যবহার করা হয়েছে

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
    }, 3500); // নোটিফিকেশনটি ৩.৫ সেকেন্ড থাকবে
}


const socket = io();

const UI_ELEMENTS = {
    authOverlay: document.getElementById('auth-overlay'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    showRegister: document.getElementById('showRegister'),
    showLogin: document.getElementById('showLogin'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginUsername'), // এখানে loginUsername হবে loginPassword
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
    messagesLoader: document.getElementById('messages-loader'), // নতুন লোডার উপাদান
    darkModeToggle: document.getElementById('darkModeToggle'), // থিম টগল
    ephemeralToggleBtn: document.getElementById('ephemeralToggleBtn'), // ইফেমিরাল টগল বাটন
    ephemeralDurationModal: document.getElementById('ephemeral-duration-modal'), // ইফেমিরাল মোডাল
    ephemeralModalCloseButton: document.getElementById('ephemeralModalCloseButton'), // ইফেমিরাল মোডাল বন্ধ বাটন
    durationChoices: document.querySelector('#ephemeral-duration-modal .duration-options') // সময়কাল অপশন কন্টেইনার
};

let username = '';
let currentRoom = '';
let userType = 'guest';
let hasMoreMessages = true; // আরও মেসেজ আছে কিনা ট্র্যাক করবে
let fetchingOlderMessages = false; // মেসেজ লোড হচ্ছে কিনা ট্র্যাক করবে
let lastFetchedMessageId = null; // লোড হওয়া সর্বশেষ মেসেজের আইডি
let isEphemeralModeActive = false; // ইফেমিরাল মোড সক্রিয় আছে কিনা ট্র্যাক করবে
let selectedEphemeralDuration = null; // নির্বাচিত ইফেমিরাল সময়কাল (মিলিসেকেন্ডে)


// ইমোজি পিকারের জন্য নতুন কোড
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
        UI_ELEMENTS.loggedInUserInfo.textContent = `${username}`;
        if (UI_ELEMENTS.logoutBtn) UI_ELEMENTS.logoutBtn.style.display = userType === 'registered' ? 'block' : 'none';
        if (UI_ELEMENTS.registerAsUserBtn) UI_ELEMENTS.registerAsUserBtn.style.display = userType === 'guest' ? 'block' : 'none';

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
        return { ok: false, data: { message: error.message || 'সার্ভার ত্রুটি।' } };
    }
}

function handleAuthSuccess(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userType', 'registered');
    localStorage.setItem('avatar', data.avatar);
    if (data.status) localStorage.setItem('status', data.status);
    authenticateSocket();
}

if (UI_ELEMENTS.showRegister) UI_ELEMENTS.showRegister.addEventListener('click', (e) => { e.preventDefault(); setUIState('register'); });
if (UI_ELEMENTS.showLogin) UI_ELEMENTS.showLogin.addEventListener('click', (e) => { e.preventDefault(); setUIState('login'); });

if (UI_ELEMENTS.loginBtn) UI_ELEMENTS.loginBtn.addEventListener('click', async () => {
    const body = { username: UI_ELEMENTS.loginUsername.value.trim(), password: UI_ELEMENTS.loginPassword.value.trim() };
    if (!body.username || !body.password) return showNotification('ইউজারনেম ও পাসওয়ার্ড দিন।', 'error'); 
    const { ok, data } = await apiRequest('/api/login', body);
    if (ok) { showNotification(data.message); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});

if (UI_ELEMENTS.registerBtn) UI_ELEMENTS.registerBtn.addEventListener('click', async () => {
    const body = { username: UI_ELEMENTS.registerUsername.value.trim(), password: UI_ELEMENTS.registerPassword.value.trim() };
    if (!body.username || !body.password) return showNotification('ইউজারনেম ও পাসওয়ার্ড দিন।', 'error'); 
    const { ok, data } = await apiRequest('/api/register', body);
    if (ok) { showNotification(data.message); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});

if (UI_ELEMENTS.guestBtn) UI_ELEMENTS.guestBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    const guestId = (localStorage.getItem('userId') && localStorage.getItem('userId').startsWith('guest-')) ? localStorage.getItem('userId') : null;
    authenticateSocket(guestId);
});

if (UI_ELEMENTS.logoutBtn) UI_ELEMENTS.logoutBtn.addEventListener('click', () => {
    ['token', 'username', 'userId', 'userType', 'lastRoom', 'savedPrivateCode', 'savedRooms', 'avatar', 'status'].forEach(key => localStorage.removeItem(key));
    socket.disconnect().connect();
    showNotification('লগআউট সফল।'); 
    setUIState('login');
});

if (UI_ELEMENTS.registerAsUserBtn) UI_ELEMENTS.registerAsUserBtn.addEventListener('click', () => {
    localStorage.removeItem('token'); 
    localStorage.removeItem('userId'); 
    localStorage.removeItem('userType'); 
    setUIState('register'); 
    showNotification('রেজিস্টার করুন।', 'success'); 
});


if (UI_ELEMENTS.clearChatBtn) UI_ELEMENTS.clearChatBtn.addEventListener('click', () => {
    if (confirm('রুমের সব মেসেজ মুছবেন?')) { 
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
        const { ok, data } = await apiRequest('/api/user/avatar', { avatar: newAvatar });
        if (ok) {
            localStorage.setItem('avatar', data.avatar);
            if (UI_ELEMENTS.userAvatarTop) UI_ELEMENTS.userAvatarTop.src = data.avatar;
            showNotification('অ্যাভাটার পরিবর্তিত হয়েছে!'); 
        } else {
            showNotification(`অ্যাভাটার পরিবর্তন সমস্যা: ${data.message}`, 'error'); 
        }
    }
});

if (UI_ELEMENTS.saveStatusBtn) UI_ELEMENTS.saveStatusBtn.addEventListener('click', async () => {
    const newStatus = UI_ELEMENTS.statusInput.value.trim();
    if (!newStatus) return showNotification('স্ট্যাটাস খালি যাবে না।', 'error'); 
    if (UI_ELEMENTS.saveStatusBtn) {
        UI_ELEMENTS.saveStatusBtn.disabled = true;
        UI_ELEMENTS.saveStatusBtn.textContent = 'সেভ হচ্ছে...'; 
    }
    const { ok, data } = await apiRequest('/api/user/status', { status: newStatus });
    if (ok) {
        localStorage.setItem('status', data.status);
        showNotification('স্ট্যাটাস আপডেট সফল!'); 
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
function displayMessage(data, prepend = false) { // prepend প্যারামিটার যোগ করা হয়েছে
    const item = document.createElement('li');
    item.dataset.messageId = data._id;

    const currentUserId = localStorage.getItem('userId');

    item.classList.add('message');
    if (data.userId === currentUserId) {
        item.classList.add('mine'); 
    } else {
        item.classList.add('theirs'); 
    }

    // ইফেমিরাল মেসেজের জন্য ক্লাস যোগ করা
    if (data.isEphemeral) {
        item.classList.add('ephemeral');
    }

    // ডেলিভারি/রিড রসিদ আইকন
    let statusIconHTML = '';
    // শুধুমাত্র নিজের পাঠানো মেসেজের জন্য স্ট্যাটাস দেখাও
    if (data.userId === currentUserId) { 
        if (data.status === 'sent') {
            statusIconHTML = '<i class="fas fa-check" style="color:#6b7280; font-size:0.75em; margin-left:5px;" title="Sent"></i>'; // সেন্ড (ধূসর)
        } else if (data.status === 'delivered') {
            statusIconHTML = '<i class="fas fa-check-double" style="color:#6b7280; font-size:0.75em; margin-left:5px;" title="Delivered"></i>'; // ডেলিভার্ড (ধূসর)
        } else if (data.status === 'read') {
            statusIconHTML = '<i class="fas fa-check-double" style="color:#3b82f6; font-size:0.75em; margin-left:5px;" title="Read"></i>'; // রিড (নীল)
        }
    }

    let buttonsHTML = '';
    // যদি মেসেজটি ডিলিট না হয় এবং নিজের মেসেজ হয়
    if (data.userId === currentUserId && data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।') { 
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
            UI_ELEMENTS.messages.prepend(item); // পুরোনো মেসেজ উপরে যোগ করা
        } else {
            UI_ELEMENTS.messages.appendChild(item); // নতুন মেসেজ নিচে যোগ করা
        }
    }
    
    // মেসেজ যখন যুক্ত হয়, তখন IntersectionObserver সেট করা
    // যদি এটি আমাদের মেসেজ না হয় এবং এখনও পড়া না হয়ে থাকে
    if (data.userId !== currentUserId && data.status !== 'read') { 
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { // যখন মেসেজটি ভিউপোর্টে আসে
                    // নিশ্চিত করুন যে socket অবজেক্ট উপলব্ধ আছে
                    if (socket && socket.emit) {
                        socket.emit('message read', { messageId: data._id, room: currentRoom });
                    }
                    observer.disconnect(); // একবার পড়া হলে অবজার্ভার ডিসকানেক্ট করো
                }
            });
        }, { threshold: 0.8 }); // মেসেজের 80% দেখা গেলে ট্রিগার হবে
        observer.observe(item);
    }

    if (data.reactions && data.reactions.length > 0) {
        renderReactions(item, data.reactions);
    }
    
    // স্ক্রল নিচে থাকবে যদি নতুন মেসেজ হয় বা যদি ব্যবহারকারী নিচে থাকে
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
    hasMoreMessages = true; // রুম পরিবর্তন করলে নতুন করে মেসেজ লোড শুরু হবে
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
            userType = res.type;
            localStorage.setItem('userId', res.userId);
            localStorage.setItem('username', res.username);
            if (res.avatar) localStorage.setItem('avatar', res.avatar);
            if (res.status) localStorage.setItem('status', res.status);
            setUIState('chat');
            const savedRoom = localStorage.getItem('lastRoom') || 'public';
            joinRoom(savedRoom);
            renderSavedRooms();
        } else {
            showNotification(res.message || 'সেশন মেয়াদোত্তীর্ণ।', 'error'); 
            setUIState('login');
        }
    });
}

window.addEventListener('load', () => {
    const token = localStorage.getItem('token'), userId = localStorage.getItem('userId'), userType = localStorage.getItem('userType');
    if (token && userType === 'registered') authenticateSocket();
    else if (userId && userType === 'guest') authenticateSocket(userId);
    else setUIState('login');

    if (UI_ELEMENTS.onlineUsersList) {
        UI_ELEMENTS.onlineUsersList.addEventListener('click', (e) => {
            const targetUserElement = e.target.closest('.online-user');
            if (targetUserElement) {
                const userId = targetUserElement.dataset.userId;
                if (typeof userId === 'string' && (userId.length === 24 || userId.startsWith('guest-'))) {
                    showUserProfile(userId);
                } else {
                    console.warn('ভুল ইউজার আইডি:', userId); 
                }
            }
        });
    } else {
        console.error("ইউজার লিস্ট পাওয়া যায়নি।"); 
    }

    // নতুন: স্ক্রল ইভেন্ট লিসেনার যোগ করা
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.addEventListener('scroll', () => {
            if (UI_ELEMENTS.messages.scrollTop === 0 && hasMoreMessages && !fetchingOlderMessages) {
                // যখন ব্যবহারকারী একদম উপরে স্ক্রল করবে
                fetchOlderMessages();
            }
        });
    }

    // থিম টগল ইভেন্ট লিসেনার
    if (UI_ELEMENTS.darkModeToggle) {
        // লোড হওয়ার সময় থিম সেট করা
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            UI_ELEMENTS.darkModeToggle.checked = true;
        } else {
            // ডিফল্ট লাইট থিম, সিস্টেম প্রিফারেন্স চেক করা যেতে পারে
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                // সিস্টেম ডার্ক মোড প্রিফার করে, কিন্তু লোকাল স্টোরেজে কিছু নেই
                // চাইলে এখানে ডিফল্ট থিম ডার্ক করা যেতে পারে বা লাইট রাখা যেতে পারে
                // বর্তমানে, লোকাল স্টোরেজ ডিফল্টকে অগ্রাধিকার দেবে
            }
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

    // ইফেমিরাল টগল বাটন ইভেন্ট লিসেনার
    if (UI_ELEMENTS.ephemeralToggleBtn) {
        UI_ELEMENTS.ephemeralToggleBtn.addEventListener('click', () => {
            UI_ELEMENTS.ephemeralDurationModal.style.display = 'flex';
        });
    }

    // ইফেমিরাল মোডাল বন্ধ বাটন
    if (UI_ELEMENTS.ephemeralModalCloseButton) {
        UI_ELEMENTS.ephemeralModalCloseButton.addEventListener('click', () => {
            UI_ELEMENTS.ephemeralDurationModal.style.display = 'none';
        });
    }

    // সময়কাল পছন্দের বাটনগুলির ইভেন্ট লিসেনার
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

// নতুন: পুরোনো মেসেজ লোড করার ফাংশন
// lastFetchedMessageId গ্লোবালভাবে সংজ্ঞায়িত আছে
async function fetchOlderMessages() {
    if (!hasMoreMessages || fetchingOlderMessages) return;

    fetchingOlderMessages = true;
    if (UI_ELEMENTS.messagesLoader) {
        UI_ELEMENTS.messagesLoader.style.display = 'flex'; // লোডার দেখাও
        UI_ELEMENTS.messagesLoader.textContent = 'লোড হচ্ছে...';
    }
    
    // বর্তমান রুমের প্রথম মেসেজের আইডি নাও
    const firstMessageElement = UI_ELEMENTS.messages.querySelector('.message');
    lastFetchedMessageId = firstMessageElement ? firstMessageElement.dataset.messageId : null;

    console.log(`Fetching older messages for room: ${currentRoom}, before: ${lastFetchedMessageId}`);
    socket.emit('fetch older messages', { roomCode: currentRoom, lastMessageId: lastFetchedMessageId });
}


// Socket.IO ইভেন্ট লিসেনার: পুরোনো মেসেজ সার্ভার থেকে পেলে
socket.on('older messages', ({ messages, hasMore }) => {
    console.log(`Received ${messages.length} older messages. Has more: ${hasMore}`);
    if (UI_ELEMENTS.messagesLoader) {
        UI_ELEMENTS.messagesLoader.style.display = 'none'; // লোডার লুকান
    }
    fetchingOlderMessages = false;
    hasMoreMessages = hasMore;

    if (messages.length === 0 && UI_ELEMENTS.messagesLoader) {
        UI_ELEMENTS.messagesLoader.style.display = 'block';
        UI_ELEMENTS.messagesLoader.textContent = 'আর কোনো পুরোনো মেসেজ নেই।';
        setTimeout(() => {
            if (UI_ELEMENTS.messagesLoader) UI_ELEMENTS.messagesLoader.style.display = 'none';
            if (UI_ELEMENTS.messagesLoader) UI_ELEMENTS.messagesLoader.textContent = 'লোড হচ্ছে...'; // ডিফল্ট টেক্সট ফিরিয়ে আনা
        }, 3000);
        return;
    }

    const oldScrollHeight = UI_ELEMENTS.messages.scrollHeight;
    messages.forEach(msg => displayMessage(msg, true)); //prepend = true মানে মেসেজগুলো উপরে যোগ হবে
    
    // স্ক্রল পজিশন অ্যাডজাস্ট করা যাতে লোড হওয়ার পর স্ক্রিন জাম্প না করে
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
    // ডিবাগিং লগ যোগ করা হয়েছে
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
    // ডিবাগিং লগ যোগ করা হয়েছে
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
            showNotification(response.message);
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
            isEphemeral: isEphemeralModeActive, // ইফেমিরাল ফ্ল্যাগ যোগ করা
            ephemeralDuration: selectedEphemeralDuration // নির্বাচিত সময়কাল যোগ করা
        });
        if (UI_ELEMENTS.input) UI_ELEMENTS.input.value = '';
        // মোডটি স্বয়ংক্রিয়ভাবে বন্ধ করতে চাইলে:
        // isEphemeralModeActive = false;
        // if (UI_ELEMENTS.ephemeralToggleBtn) UI_ELEMENTS.ephemeralToggleBtn.classList.remove('active');
        // selectedEphemeralDuration = null;
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
    
    // ইমোজি প্যালেট দেখানো বা লুকানো
    if (messageContent && !e.target.classList.contains('reaction-choice') && !e.target.closest('.message-actions')) {
        const palette = messageContent.querySelector('.reaction-palette');
        if (palette) {
            // সমস্ত প্যালেট লুকান
            document.querySelectorAll('.reaction-palette').forEach(p => {
                if (p !== palette) p.style.display = 'none';
            });
            // বর্তমান মেসেজের প্যালেট টগল করুন
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

// নতুন কোড: ডিলিট কনফার্মেশন মোডালের জন্য ইভেন্ট লিসেনার
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

// public/main.js -> socket.on('online users list', ...)
socket.on('online users list', (users) => {
    const uniqueUsers = [...new Map(users.map(item => [item.userId, item])).values()];
    const listHtml = uniqueUsers.map(user =>
        `<li class="online-user" data-user-id="${user.userId}">
            <img src="${user.avatar}" class="online-user-avatar" data-user-id="${user.userId}">
            <span class="online-status-dot"></span> 
            <span class="online-username-text">${user.username}</span> 
        </li>`
    ).join('');
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
        msgs.forEach(msg => displayMessage(msg, false)); // false মানে নতুন মেসেজ হিসেবে যোগ হবে
    }
});

socket.on('chat message', displayMessage);

socket.on('user joined', (msg) => {
    const item = document.createElement('li');
    item.classList.add('message', 'system'); 
    item.innerHTML = `<i>${msg}</i>`;
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.appendChild(item);
    }
});

socket.on('message edited', ({ messageId, newMessageText }) => {
    const msgLi = document.querySelector(`li[data-message-id="${messageId}"]`);
    if (msgLi) {
        const textElem = msgLi.querySelector('.message-text');
        if (textElem) textElem.textContent = newMessageText;
        // যদি মেসেজ মুছে ফেলা হয়, তাহলে এডিট/ডিলিট বাটন সরিয়ে ফেলা
        if (newMessageText === 'এই মেসেজটি মুছে ফেলা হয়েছে।') { 
            const messageActions = msgLi.querySelector('.message-actions');
            if (messageActions) messageActions.remove();
        }
        // যদি এখনও এডিটেড ইন্ডিকেটর না থাকে এবং মেসেজটি মুছে ফেলা না হয়
        if (!msgLi.querySelector('.edited-indicator') && newMessageText !== 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
            const indicator = document.createElement('small');
            indicator.className = 'edited-indicator';
            indicator.textContent = ' (সম্পাদিত)'; 
            textElem.insertAdjacentElement('afterend', indicator);
        } else if (newMessageText === 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
            // যদি মেসেজ মুছে ফেলা হয় এবং এডিটেড ইন্ডিকেটর থাকে, তাহলে সেটি সরিয়ে ফেলা
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
    }
});

// socket.on('message status updated') ফাংশন - ইনলাইন স্টাইল সহ
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
                iconColor = '#6b7280'; // ধূসর
                iconTitle = 'Sent';
            } else if (status === 'delivered') {
                iconClass = 'fas fa-check-double';
                iconColor = '#6b7280'; // ধূসর
                iconTitle = 'Delivered';
            } else if (status === 'read') {
                iconClass = 'fas fa-check-double';
                iconColor = '#3b82f6'; // নীল
                iconTitle = 'Read';
            }
            
            const newIconHTML = `<i class="${iconClass}" style="color:${iconColor}; font-size:0.75em; margin-left:5px;" title="${iconTitle}"></i>`;
            
            // বিদ্যমান আইকনটি খুঁজে বের করে আপডেট করা
            const existingIcon = timestampSpan.querySelector('.fas');
            if (existingIcon) {
                // বিদ্যমান আইকনের ক্লাস এবং স্টাইল পরিবর্তন করো
                existingIcon.className = iconClass; // ক্লাস পরিবর্তন
                existingIcon.style.color = iconColor; // রঙ পরিবর্তন
                existingIcon.title = iconTitle; // টাইটেল পরিবর্তন
                // অন্যান্য স্টাইল যেমন font-size, margin-left অপরিবর্তিত থাকবে
            } else {
                // যদি কোনো কারণে আইকন না থাকে, তবে নতুন আইকন HTML যোগ করো
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