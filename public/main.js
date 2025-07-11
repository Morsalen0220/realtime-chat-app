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
    loginPassword: document.getElementById('loginPassword'),
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
    userProfileInfo: document.getElementById('user-profile-info'),
    userAvatarTop: document.getElementById('user-avatar-top'),
    
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
    durationChoices: document.querySelector('#ephemeral-duration-modal .duration-options'),
};

let username = '';
let currentRoom = '';
let userType = 'guest'; 
let hasMoreMessages = true;
let fetchingOlderMessages = false;
let lastFetchedMessageId = null;
let isEphemeralModeActive = false;
let selectedEphemeralDuration = null;

let currentRoomUserRole = 'room_member'; 


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
        UI_ELEMENTS.loggedInUserInfo.textContent = `${localStorage.getItem('username') || 'Guest'}`;

        const currentUserType = localStorage.getItem('userType');
        if (UI_ELEMENTS.logoutBtn) UI_ELEMENTS.logoutBtn.style.display = currentUserType === 'registered' ? 'block' : 'none';
        if (UI_ELEMENTS.registerAsUserBtn) UI_ELEMENTS.registerAsUserBtn.style.display = currentUserType === 'guest' ? 'block' : 'none';

        const avatar = localStorage.getItem('avatar');
        if (avatar && UI_ELEMENTS.userAvatarTop) UI_ELEMENTS.userAvatarTop.src = avatar;
    }
}

async function apiRequest(endpoint, body, method = 'POST') {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(endpoint, {
            method: method,
            headers: headers,
            body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'কিছু সমস্যা হয়েছে'); 
        return { ok: true, data };
    } catch (error) {
        console.error('API Request Error:', error);
        return { ok: false, data: { message: error.message || 'সার্ভার ত্রুটি।' } };
    }
}

function handleAuthSuccess(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userType', data.type || 'registered');
    localStorage.setItem('avatar', data.avatar);
    if (data.status) localStorage.setItem('status', data.status);
    if (data.role) localStorage.setItem('userRole', data.role);
    authenticateSocket();
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

    if (body.password.length < 6) {
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

    if (body.password.length < 6) {
        return showNotification('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।', 'error');
    }

    const { ok, data } = await apiRequest('/api/register', body);
    if (ok) { showNotification(data.message, 'success'); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});

if (UI_ELEMENTS.guestBtn) UI_ELEMENTS.guestBtn.addEventListener('click', () => {
    localStorage.removeItem('token'); 
    localStorage.removeItem('userRole'); 
    
    let guestId = localStorage.getItem('userId');
    let userTypeFromStorage = localStorage.getItem('userType');

    if (!guestId || !guestId.startsWith('guest-') || userTypeFromStorage !== 'guest') {
        guestId = `guest-${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem('userId', guestId);
        localStorage.setItem('username', `Guest-${guestId.substring(6, 10)}`);
        localStorage.setItem('avatar', 'avatars/avatar1.png');
        localStorage.setItem('userType', 'guest');
        localStorage.setItem('status', 'আমি একজন অতিথি ব্যবহারকারী।');
        localStorage.setItem('userRole', 'user');
    }

    authenticateSocket(guestId);
});

if (UI_ELEMENTS.logoutBtn) UI_ELEMENTS.logoutBtn.addEventListener('click', () => {
    ['token', 'username', 'userId', 'userType', 'lastRoom', 'savedPrivateCode', 'savedRooms', 'avatar', 'status', 'userRole'].forEach(key => localStorage.removeItem(key));
    
    socket.disconnect().connect(); 
    
    showNotification('লগআউট সফল।', 'success'); 
    setUIState('login');
});

if (UI_ELEMENTS.registerAsUserBtn) UI_ELEMENTS.registerAsUserBtn.addEventListener('click', () => {
    localStorage.removeItem('token'); 
    localStorage.removeItem('userId'); 
    localStorage.removeItem('userType'); 
    localStorage.removeItem('userRole'); 
    localStorage.removeItem('username');
    localStorage.removeItem('avatar');
    localStorage.removeItem('status');

    setUIState('register'); 
    showNotification('আপনার তথ্য দিয়ে রেজিস্টার করুন।', 'info'); 
});


if (UI_ELEMENTS.clearChatBtn) UI_ELEMENTS.clearChatBtn.addEventListener('click', () => {
    if (confirm('আপনি কি নিশ্চিত যে এই রুমের সব মেসেজ মুছে ফেলতে চান? এই কাজটি শুধুমাত্র অ্যাডমিন বা মডারেটররা করতে পারবে।')) { 
        socket.emit('clear room chat', { roomCode: currentRoom });
    }
});

// প্রোফাইল মোডাল খোলার লজিকটি সরানো হয়েছে, এখন এটি সরাসরি প্রোফাইল পেজে রিডাইরেক্ট করবে
if (UI_ELEMENTS.userProfileInfo) UI_ELEMENTS.userProfileInfo.addEventListener('click', () => {
    const userId = localStorage.getItem('userId');
    if (userId) {
        window.location.href = `/profile?id=${userId}`; // নিজের প্রোফাইল পেজে রিডাইরেক্ট
    } else {
        showNotification('আপনার প্রোফাইল আইডি খুঁজে পাওয়া যায়নি।', 'error');
    }
});


function displayMessage(data, prepend = false) {
    const item = document.createElement('li');
    item.dataset.messageId = data._id;

    const currentUserId = localStorage.getItem('userId');
    const currentUserGlobalRole = localStorage.getItem('userRole') || 'user';
    const currentUserRoomRole = currentRoomUserRole;

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

    let buttonsHTML = ''; 
    if (data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে.' && 
       (data.userId === currentUserId || 
        currentUserGlobalRole === 'admin' || currentUserGlobalRole === 'moderator' ||
        currentUserRoomRole === 'room_admin' || currentUserRoomRole === 'room_moderator')) {
        buttonsHTML = `<div class="message-actions"><button class="edit-btn" title="সম্পাদনা">✏️</button><button class="delete-btn" title="মুছুন">🗑️</button></div>`; 
    }
    const editedIndicator = data.isEdited && data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে.' ? `<small class="edited-indicator">(সম্পাদিত)</small>` : ''; 
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
    currentRoomUserRole = 'room_member';

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
    } else {
        localStorage.removeItem('savedPrivateCode');
    }

    if (UI_ELEMENTS.roomsModal) {
        UI_ELEMENTS.roomsModal.style.display = 'none';
    }

    if (UI_ELEMENTS.privateChatBtn) {
        UI_ELEMENTS.privateChatBtn.classList.remove('active'); 
    }
    if (UI_ELEMENTS.publicChatBtn) {
        UI_ELEMENTS.publicChatBtn.classList.remove('active'); 
    }
    if (roomName === 'public') { 
        if (UI_ELEMENTS.publicChatBtn) UI_ELEMENTS.publicChatBtn.classList.add('active');
        if (UI_ELEMENTS.roomCodeInput) {
            UI_ELEMENTS.roomCodeInput.value = ''; 
            UI_ELEMENTS.privateCodeSection.style.display = 'none';
        }
    } else { 
        if (UI_ELEMENTS.privateChatBtn) UI_ELEMENTS.privateChatBtn.classList.add('active');
        if (UI_ELEMENTS.roomCodeInput) {
            UI_ELEMENTS.roomCodeInput.value = roomName; 
            UI_ELEMENTS.privateCodeSection.style.display = 'flex';
        }
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
            userType = res.type;
            localStorage.setItem('userId', res.userId);
            localStorage.setItem('username', res.username);
            localStorage.setItem('userType', res.type);
            if (res.avatar) localStorage.setItem('avatar', res.avatar);
            if (res.status) localStorage.setItem('status', res.status);
            if (res.role) localStorage.setItem('userRole', res.role);
            
            console.log("DEBUG main.js: Authenticated as:", { username: res.username, type: res.type, userId: res.userId, globalRole: res.role });
            
            setUIState('chat');
            
            const lastRoom = localStorage.getItem('lastRoom') || 'public';
            joinRoom(lastRoom); 
            const urlParams = new URLSearchParams(window.location.search);
            const initialRoom = urlParams.get('room');

            if (initialRoom) {
                joinRoom(initialRoom); // যদি URL এ রুম থাকে, সেই রুমে জয়েন করো
                // URL থেকে রুম প্যারামিটার সরিয়ে ফেলা, যাতে রিফ্রেশ করলে আবার এই রুমে না যায় (ঐচ্ছিক)
                history.replaceState({}, document.title, window.location.pathname);
            } else {
                // যদি URL এ রুম না থাকে, তাহলে lastRoom বা ডিফল্ট 'public' রুমে জয়েন করো
                const lastRoom = localStorage.getItem('lastRoom') || 'public';
                joinRoom(lastRoom); 
            }
            renderSavedRooms();
            
            const savedTheme = localStorage.getItem('theme');
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }

            const savedAvatar = localStorage.getItem('avatar');
            if (savedAvatar && UI_ELEMENTS.userAvatarTop) {
                UI_ELEMENTS.userAvatarTop.src = savedAvatar;
            }
        } else {
            console.error("DEBUG main.js: Authentication failed:", res.message);
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            localStorage.removeItem('userId'); 
            localStorage.removeItem('userType');
            localStorage.removeItem('avatar');
            localStorage.removeItem('status');
            localStorage.removeItem('userRole');
            
            if (!guestId || !guestId.startsWith('guest-')) {
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
    const token = localStorage.getItem('token');
    const storedUserId = localStorage.getItem('userId');
    const storedUserType = localStorage.getItem('userType');

    userType = storedUserType; 

    console.log("DEBUG main.js: On Load - Initial token:", token);
    console.log("DEBUG main.js: On Load - Initial userId:", storedUserId);
    console.log("DEBUG main.js: On Load - Initial userType:", storedUserType);
    console.log("DEBUG main.js: On Load - Initial userRole:", localStorage.getItem('userRole'));


    if (token && storedUserType === 'registered') {
        console.log("DEBUG main.js: On Load - Found registered session, authenticating.");
        authenticateSocket();
    } else if (storedUserId && storedUserType === 'guest') {
        console.log("DEBUG main.js: On Load - Found guest session, authenticating as guest.");
        authenticateSocket(storedUserId);
    } else {
        console.log("DEBUG main.js: On Load - No valid session found, showing login screen.");
        setUIState('login');
    }

    // অনলাইন ইউজারের লিস্টে ক্লিক হ্যান্ডেল করা (সাইডবার)
    if (UI_ELEMENTS.onlineUsersList) {
        UI_ELEMENTS.onlineUsersList.addEventListener('click', (e) => {
            const targetUserElement = e.target.closest('.online-user');
            if (targetUserElement) {
                const userId = targetUserElement.dataset.userId;
                if (e.target.classList.contains('online-user-avatar') || e.target.classList.contains('online-username-text')) {
                    if (typeof userId === 'string' && (userId.length === 24 || userId.startsWith('guest-'))) {
                        showUserProfile(userId);
                    } else {
                        console.warn('ভুল ইউজার আইডি:', userId); 
                    }
                }
            }
        });
    } else {
        console.error("ইউজার লিস্ট পাওয়া যায়নি।"); 
    }

    // চ্যাট মেসেজের অ্যাভাতারে ক্লিক হ্যান্ডেল করা
    if (UI_ELEMENTS.messages) {
        UI_ELEMENTS.messages.addEventListener('click', (e) => {
            const avatarElement = e.target.closest('.chat-avatar');
            if (avatarElement) {
                const userId = avatarElement.dataset.userId;
                if (userId) {
                    showUserProfile(userId); // প্রোফাইল দেখানোর ফাংশন কল
                } else {
                    console.warn("অ্যাভাটারে ইউজার আইডি পাওয়া যায়নি।");
                }
            }
            // ... অন্যান্য মেসেজ-সম্পর্কিত ক্লিক লজিক যেমন রিয়্যাকশন, এডিট, ডিলিট
        });

        // পুরনো মেসেজ লোড করার স্ক্রল ইভেন্ট
        UI_ELEMENTS.messages.addEventListener('scroll', () => {
            if (UI_ELEMENTS.messages.scrollTop === 0 && hasMoreMessages && !fetchingOlderMessages) {
                fetchOlderMessages();
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

    socket.emit('fetch older messages', { roomCode: currentRoom, lastMessageId: lastFetchedMessageId });
}


socket.on('older messages', ({ messages, hasMore }) => {
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

socket.on('room role updated', ({ roomCode, role }) => {
    if (roomCode === currentRoom) {
        currentRoomUserRole = role;
        console.log(`DEBUG main.js: Room role updated for ${currentRoom}: ${currentRoomUserRole}`);
    }
});


if (UI_ELEMENTS.publicChatBtn) UI_ELEMENTS.publicChatBtn.addEventListener('click', () => {
    UI_ELEMENTS.publicChatBtn.classList.add('active');
    if (UI_ELEMENTS.privateChatBtn) UI_ELEMENTS.privateChatBtn.classList.remove('active');
    if (UI_ELEMENTS.privateCodeSection) {
        UI_ELEMENTS.privateCodeSection.style.display = 'none';
        UI_ELEMENTS.roomCodeInput.value = '';
    }
    joinRoom('public');
});

if (UI_ELEMENTS.privateChatBtn) UI_ELEMENTS.privateChatBtn.addEventListener('click', () => {
    UI_ELEMENTS.privateChatBtn.classList.add('active');
    if (UI_ELEMENTS.publicChatBtn) UI_ELEMENTS.publicChatBtn.classList.remove('active');
    
    if (UI_ELEMENTS.privateCodeSection) {
        UI_ELEMENTS.privateCodeSection.style.display = 'flex';

        const savedPrivateCode = localStorage.getItem('savedPrivateCode');
        if (savedPrivateCode) {
            UI_ELEMENTS.roomCodeInput.value = savedPrivateCode;
            joinRoom(savedPrivateCode);
        } else {
            UI_ELEMENTS.roomCodeInput.value = '';
        }
    }
});
if (UI_ELEMENTS.joinPrivateRoomBtn) UI_ELEMENTS.joinPrivateRoomBtn.addEventListener('click', () => {
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) {
        return showNotification('প্রাইভেট কোড লিখুন!', 'error');
    }
    socket.emit('check room existence', privateCode, (exists) => {
        if (exists) {
            joinRoom(privateCode);
        } else {
            showNotification('রুমটি নেই। নতুন তৈরি করুন।', 'error');
        }
    });
});

if (UI_ELEMENTS.createPrivateRoomBtn) UI_ELEMENTS.createPrivateRoomBtn.addEventListener('click', () => {
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) {
        return showNotification('প্রাইভেট কোড লিখুন!', 'error');
    }
    const userId = localStorage.getItem('userId');
    const globalRole = localStorage.getItem('userRole') || 'user';
    socket.emit('create private room', { roomCode: privateCode, userId: userId, globalRole: globalRole }, (response) => {
        if (response.success) {
            joinRoom(privateCode);
            showNotification(response.message, 'success');
        } else {
            showNotification(response.message || 'রুম তৈরি সমস্যা।', 'error');
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
    
    // Reaction palette toggle logic
    if (messageContent && !e.target.classList.contains('reaction-choice') && !e.target.closest('.message-actions')) {
        const clickedPalette = messageContent.querySelector('.reaction-palette'); 
        
        document.querySelectorAll('.reaction-palette').forEach(p => {
            if (p && p !== clickedPalette) { 
                p.style.display = 'none';
            }
        });

        if (clickedPalette) {
            clickedPalette.style.display = clickedPalette.style.display === 'none' ? 'flex' : 'none';
        }
    }
    
    // Reaction choice click logic
    if (e.target.classList.contains('reaction-choice')) {
        const messageId = messageLi.dataset.messageId;
        const emoji = e.target.dataset.emoji;
        socket.emit('message reaction', { messageId, emoji });
        const palette = e.target.closest('.reaction-palette');
        if (palette) palette.style.display = 'none';
        return;
    }
    
    // Handle Edit/Delete buttons or other message-related clicks
    if (!messageLi) return;
    const messageId = messageLi.dataset.messageId;
    
    if (UI_ELEMENTS.confirmDeleteBtn && UI_ELEMENTS.deleteConfirmationModal && e.target.classList.contains('delete-btn')) {
        UI_ELEMENTS.confirmDeleteBtn.dataset.messageId = messageId;
        UI_ELEMENTS.deleteConfirmationModal.style.display = 'flex'; 
    } 
    else if (e.target.classList.contains('edit-btn')) {
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
    window.location.href = `/profile?id=${userId}`; // প্রোফাইল পেজে রিডাইরেক্ট
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
    const uniqueUsers = [...new Map(users.map(item => [item.userId, item])).values()];
    
    const listHtml = uniqueUsers.map(user => {
        return `<li class="online-user" data-user-id="${user.userId}">
                    <img src="${user.avatar}" class="online-user-avatar" data-user-id="${user.userId}">
                    <span class="online-status-dot"></span> 
                    <span class="online-username-text">${user.username}</span> 
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
        if (!msgLi.querySelector('.edited-indicator') && newMessageText !== 'এই মেসেজটি মুছে ফেলা হয়েছে.') {
            const indicator = document.createElement('small');
            indicator.className = 'edited-indicator';
            indicator.textContent = ' (সম্পাদিত)'; 
            textElem.insertAdjacentElement('afterend', indicator);
        } else if (newMessageText === 'এই মেসেজটি মুছে ফেলা হয়েছে.') {
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
        UI_ELEMENTS.messages.scrollTop = UI_ELEMENTS.messages.scrollHeight;
    }
});

socket.on('message status updated', ({ messageId, status }) => {
    if (UI_ELEMENTS.messages) console.log(`[ক্লায়েন্ট] মেসেজ স্ট্যাটাস আপডেট ইভেন্ট পাওয়া গেছে (ID: ${messageId}, স্ট্যাটাস: ${status})`); 

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
        joinRoom('public');
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