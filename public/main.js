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
    onlineUsersCountDisplay: document.getElementById('onlineUsersCountDisplay') 
};

let username = '';
let currentRoom = '';
let userType = 'guest';

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
function displayMessage(data) {
    const item = document.createElement('li');
    item.dataset.messageId = data._id;

    const currentUserId = localStorage.getItem('userId');

    item.classList.add('message');
    if (data.userId === currentUserId) {
        item.classList.add('mine'); 
    } else {
        item.classList.add('theirs'); 
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
    if (data.userId === currentUserId && data.message !== 'মেসেজ মোছা হয়েছে।') { 
        buttonsHTML = `<div class="message-actions"><button class="edit-btn" title="সম্পাদনা">✏️</button><button class="delete-btn" title="মুছুন">🗑️</button></div>`; 
    }
    const editedIndicator = data.isEdited && data.message !== 'মেসেজ মোছা হয়েছে।' ? `<small class="edited-indicator">(সম্পাদিত)</small>` : ''; 
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
                ${statusIconHTML} <!-- স্ট্যাটাস আইকন যোগ করা হয়েছে -->
            </small>
        </div>
        ${buttonsHTML}
    `;

    if (UI_ELEMENTS.messages) UI_ELEMENTS.messages.appendChild(item);
    
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
    
    if (UI_ELEMENTS.messages && UI_ELEMENTS.messages.scrollTop + UI_ELEMENTS.messages.clientHeight >= UI_ELEMENTS.messages.scrollHeight - 150) {
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
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) return showNotification('প্রাইভেট কোড লিখুন!', 'error'); 
    socket.emit('check room existence', privateCode, (exists) => {
        if (exists) joinRoom(privateCode);
        else showNotification('রুমটি নেই। নতুন তৈরি করুন।', 'error'); 
    });
});

if (UI_ELEMENTS.createPrivateRoomBtn) UI_ELEMENTS.createPrivateRoomBtn.addEventListener('click', () => {
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) return showNotification('প্রাইভেট কোড লিখুন!', 'error'); 
    socket.emit('create private room', privateCode, username, (response) => {
        if (response.success) {
            joinRoom(privateCode);
            showNotification(response.message);
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
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
    
    if (messageContent && !e.target.classList.contains('reaction-choice')) {
        const palette = messageContent.querySelector('.reaction-palette');
        if (palette) {
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
        msgs.forEach(displayMessage);
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
        if (newMessageText === 'মেসেজ মোছা হয়েছে।') { 
            if (msgLi.querySelector('.message-actions')) msgLi.querySelector('.message-actions').remove();
        }
        if (!msgLi.querySelector('.edited-indicator') && textElem) {
            const indicator = document.createElement('small');
            indicator.className = 'edited-indicator';
            indicator.textContent = ' (সম্পাদিত)'; 
            textElem.insertAdjacentElement('afterend', indicator);
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
            
            const existingIcon = timestampSpan.querySelector('.fas');
            if (existingIcon) {
                // বিদ্যমান আইকনের ক্লাস এবং স্টাইল পরিবর্তন করো
                existingIcon.className = iconClass;
                existingIcon.style.color = iconColor;
                existingIcon.style.fontSize = '0.75em';
                existingIcon.style.marginLeft = '5px';
                existingIcon.title = iconTitle;
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
