// নোটিফিকেশন দেখানোর জন্য একটি হেল্পার ফাংশন
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container');
    if (!container) return; // কন্টেইনার না থাকলে কিছুই করবে না

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

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
    profileViewStatus: document.getElementById('profile-view-status')
};

let username = '';
let currentRoom = '';
let userType = 'guest';

// ইমোজি পিকারের জন্য নতুন কোড
const emojiBtn = document.getElementById('emoji-btn');
const messageInput = document.getElementById('input'); // তোমার মেসেজ ইনপুট ফিল্ডের আইডি

if (emojiBtn && messageInput) {
    const picker = new EmojiButton({
        position: 'top-start', // পিকারটি বাটনের উপরে বাম দিকে দেখাবে
        theme: 'auto', // সিস্টেম থিম (লাইট/ডার্ক) অনুসরণ করবে
        showSearch: true, // সার্চ বার দেখাবে
        showRecents: true, // সাম্প্রতিক ব্যবহৃত ইমোজি দেখাবে
        showVariants: true // ইমোজি ভ্যারিয়েন্ট দেখাবে (যেমন স্কিন টোন)
    });

    picker.on('emoji', emoji => {
        messageInput.value += emoji; // নির্বাচিত ইমোজি ইনপুট ফিল্ডে যোগ করবে
        messageInput.focus(); // ইনপুট ফিল্ডে ফোকাস রাখবে
    });

    emojiBtn.addEventListener('click', () => {
        picker.showPicker(emojiBtn); // বাটনে ক্লিক করলে পিকার দেখাবে
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
        UI_ELEMENTS.logoutBtn.style.display = userType === 'registered' ? 'block' : 'none';
        const avatar = localStorage.getItem('avatar');
        if (avatar) UI_ELEMENTS.userAvatarTop.src = avatar;
    }
};

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
        if (!res.ok) throw new Error(data.message || 'Something went wrong');
        return { ok: true, data };
    } catch (error) {
        return { ok: false, data: { message: error.message || 'সার্ভার ত্রুটি।' } };
    }
};

function handleAuthSuccess(data) {
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userType', 'registered');
    localStorage.setItem('avatar', data.avatar);
    if (data.status) localStorage.setItem('status', data.status);
    authenticateSocket();
};

UI_ELEMENTS.showRegister.addEventListener('click', (e) => { e.preventDefault(); setUIState('register'); });
UI_ELEMENTS.showLogin.addEventListener('click', (e) => { e.preventDefault(); setUIState('login'); });

UI_ELEMENTS.loginBtn.addEventListener('click', async () => {
    const body = { username: UI_ELEMENTS.loginUsername.value.trim(), password: UI_ELEMENTS.loginPassword.value.trim() };
    if (!body.username || !body.password) return showNotification('অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।', 'error');
    const { ok, data } = await apiRequest('/api/login', body);
    if (ok) { showNotification(data.message); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});

UI_ELEMENTS.registerBtn.addEventListener('click', async () => {
    const body = { username: UI_ELEMENTS.registerUsername.value.trim(), password: UI_ELEMENTS.registerPassword.value.trim() };
    if (!body.username || !body.password) return showNotification('অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।', 'error');
    const { ok, data } = await apiRequest('/api/register', body);
    if (ok) { showNotification(data.message); handleAuthSuccess(data); } else { showNotification(data.message, 'error'); }
});

UI_ELEMENTS.guestBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    const guestId = (localStorage.getItem('userId') && localStorage.getItem('userId').startsWith('guest-')) ? localStorage.getItem('userId') : null;
    authenticateSocket(guestId);
});

UI_ELEMENTS.logoutBtn.addEventListener('click', () => {
    ['token', 'username', 'userId', 'userType', 'lastRoom', 'savedPrivateCode', 'savedRooms', 'avatar', 'status'].forEach(key => localStorage.removeItem(key));
    socket.disconnect().connect();
    showNotification('সফলভাবে লগআউট হয়েছে।');
    setUIState('login');
});

UI_ELEMENTS.clearChatBtn.addEventListener('click', () => {
    if (confirm('আপনি কি এই রুমের সব মেসেজ সবার জন্য স্থায়ীভাবে মুছে ফেলতে চান?')) {
        socket.emit('clear room chat', { roomCode: currentRoom });
    }
});

UI_ELEMENTS.userProfileInfo.addEventListener('click', () => {
    UI_ELEMENTS.statusInput.value = localStorage.getItem('status') || '';
    UI_ELEMENTS.profileModal.style.display = 'flex';
});

UI_ELEMENTS.profileModalCloseBtn.addEventListener('click', () => {
    UI_ELEMENTS.profileModal.style.display = 'none';
});

UI_ELEMENTS.avatarOptions.addEventListener('click', async (e) => {
    if (e.target.classList.contains('avatar-choice')) {
        const newAvatar = e.target.dataset.avatar;
        const { ok, data } = await apiRequest('/api/user/avatar', { avatar: newAvatar });
        if (ok) {
            localStorage.setItem('avatar', data.avatar);
            UI_ELEMENTS.userAvatarTop.src = data.avatar;
            showNotification('অ্যাভাটার সফলভাবে পরিবর্তিত হয়েছে!');
        } else {
            showNotification(`অ্যাভাটার পরিবর্তন করতে সমস্যা হয়েছে: ${data.message}`, 'error');
        }
    }
});

UI_ELEMENTS.saveStatusBtn.addEventListener('click', async () => {
    const newStatus = UI_ELEMENTS.statusInput.value.trim();
    if (!newStatus) return showNotification('স্ট্যাটাস খালি রাখা যাবে না।', 'error');
    UI_ELEMENTS.saveStatusBtn.disabled = true;
    UI_ELEMENTS.saveStatusBtn.textContent = 'সেভিং...';
    const { ok, data } = await apiRequest('/api/user/status', { status: newStatus });
    if (ok) {
        localStorage.setItem('status', data.status);
        showNotification('স্ট্যাটাস সফলভাবে আপডেট হয়েছে!');
        UI_ELEMENTS.profileModal.style.display = 'none';
    } else {
        showNotification(`স্ট্যাটাস আপডেট করতে সমস্যা হয়েছে: ${data.message}`, 'error');
    }
    UI_ELEMENTS.saveStatusBtn.disabled = false;
    UI_ELEMENTS.saveStatusBtn.textContent = 'স্ট্যাটাস সেভ করুন';
});

// main.js -> displayMessage ফাংশন

function displayMessage(data) {
    const item = document.createElement('li');
    item.dataset.messageId = data._id;

    const currentUserId = localStorage.getItem('userId');

    // মেসেজের ধরনের উপর ভিত্তি করে ক্লাস যোগ করা হচ্ছে
    item.classList.add('message');
    if (data.userId === currentUserId) {
        item.classList.add('mine'); // আমার নিজের মেসেজ
    } else {
        item.classList.add('theirs'); // অন্য ইউজারের মেসেজ
    }

    let buttonsHTML = '';
    if (data.userId === currentUserId && data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
        buttonsHTML = `<div class="message-actions"><button class="edit-btn" title="Edit">✏️</button><button class="delete-btn" title="Delete">🗑️</button></div>`;
    }
    const editedIndicator = data.isEdited && data.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।' ? `<small class="edited-indicator">(edited)</small>` : '';
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
            <small class="timestamp">${data.timestamp}</small>
        </div>
        ${buttonsHTML}
    `;

    UI_ELEMENTS.messages.appendChild(item);
    
    if (data.reactions && data.reactions.length > 0) {
        renderReactions(item, data.reactions);
    }
    
    if (UI_ELEMENTS.messages.scrollTop + UI_ELEMENTS.messages.clientHeight >= UI_ELEMENTS.messages.scrollHeight - 150) {
        UI_ELEMENTS.messages.scrollTop = UI_ELEMENTS.messages.scrollHeight;
    }
}

function joinRoom(roomName) {
    currentRoom = roomName;
    UI_ELEMENTS.currentRoomDisplayTop.textContent = `আপনি ${currentRoom === 'public' ? 'পাবলিক চ্যাটে' : currentRoom + ' রুমে'} আছেন`;
    UI_ELEMENTS.messages.innerHTML = '';
    socket.emit('join room', currentRoom);
    localStorage.setItem('lastRoom', roomName);
    if (roomName !== 'public') {
        localStorage.setItem('savedPrivateCode', roomName);
        addRoomToSavedList(roomName);
    }
    UI_ELEMENTS.roomsModal.style.display = 'none';
};

function addRoomToSavedList(roomCode) {
    let savedRooms = JSON.parse(localStorage.getItem('savedRooms') || '[]');
    if (!savedRooms.includes(roomCode) && roomCode !== 'public') {
        savedRooms.push(roomCode);
        localStorage.setItem('savedRooms', JSON.stringify(savedRooms));
        renderSavedRooms();
    }
};

function renderSavedRooms() {
    const savedRooms = JSON.parse(localStorage.getItem('savedRooms') || '[]');
    UI_ELEMENTS.savedRoomsList.innerHTML = '';
    ['public', ...savedRooms.filter(r => r !== 'public')].forEach(room => {
        const li = document.createElement('li');
        li.textContent = room === 'public' ? 'পাবলিক চ্যাট' : room;
        li.addEventListener('click', () => joinRoom(room));
        UI_ELEMENTS.savedRoomsList.appendChild(li);
    });
};

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
            showNotification(res.message || 'সেশন মেয়াদোত্তীর্ণ হয়েছে।', 'error');
            setUIState('login');
        }
    });
};

window.addEventListener('load', () => {
    const token = localStorage.getItem('token'), userId = localStorage.getItem('userId'), userType = localStorage.getItem('userType');
    if (token && userType === 'registered') authenticateSocket();
    else if (userId && userType === 'guest') authenticateSocket(userId);
    else setUIState('login');
});

UI_ELEMENTS.publicChatBtn.addEventListener('click', () => {
    UI_ELEMENTS.publicChatBtn.classList.add('active');
    UI_ELEMENTS.privateChatBtn.classList.remove('active');
    UI_ELEMENTS.privateCodeSection.style.display = 'none';
    joinRoom('public');
});

UI_ELEMENTS.privateChatBtn.addEventListener('click', () => {
    UI_ELEMENTS.privateChatBtn.classList.add('active');
    UI_ELEMENTS.publicChatBtn.classList.remove('active');
    UI_ELEMENTS.privateCodeSection.style.display = 'flex';
});

UI_ELEMENTS.joinPrivateRoomBtn.addEventListener('click', () => {
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) return showNotification('অনুগ্রহ করে একটি প্রাইভেট কোড লিখুন!', 'error');
    socket.emit('check room existence', privateCode, (exists) => {
        if (exists) joinRoom(privateCode);
        else showNotification('এই রুমটি বিদ্যমান নেই। একটি নতুন রুম তৈরি করুন।', 'error');
    });
});

UI_ELEMENTS.createPrivateRoomBtn.addEventListener('click', () => {
    const privateCode = UI_ELEMENTS.roomCodeInput.value.trim();
    if (!privateCode) return showNotification('অনুগ্রহ করে একটি প্রাইভেট কোড লিখুন!', 'error');
    socket.emit('create private room', privateCode, username, (response) => {
        if (response.success) {
            joinRoom(privateCode);
            showNotification(response.message);
        } else {
            showNotification(response.message || 'রুম তৈরি করতে সমস্যা হয়েছে।', 'error');
        }
    });
});

UI_ELEMENTS.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = UI_ELEMENTS.input.value.trim();
    if (message) {
        socket.emit('chat message', {
            message,
            room: currentRoom,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        UI_ELEMENTS.input.value = '';
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

UI_ELEMENTS.messages.addEventListener('click', (e) => {
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
    if (e.target.classList.contains('delete-btn') && confirm('আপনি কি মেসেজটি মুছে ফেলতে চান?')) {
        socket.emit('delete message', { messageId });
    } else if (e.target.classList.contains('edit-btn')) {
        const textElem = messageLi.querySelector('.message-text');
        const newText = prompt('মেসেজ এডিট করুন:', textElem.textContent);
        if (newText && newText.trim() !== '' && newText !== textElem.textContent) {
            socket.emit('edit message', { messageId, newMessageText: newText });
        }
    }
});

async function showUserProfile(userId) {
    if (!userId) return;
    UI_ELEMENTS.viewProfileModal.style.display = 'flex';
    UI_ELEMENTS.profileViewUsername.textContent = 'লোড হচ্ছে...';
    UI_ELEMENTS.profileViewStatus.textContent = '';
    try {
        const response = await fetch(`/api/user/${userId}`);
        const user = await response.json();
        if (response.ok) {
            UI_ELEMENTS.profileViewAvatar.src = user.avatar;
            UI_ELEMENTS.profileViewUsername.textContent = user.username;
            UI_ELEMENTS.profileViewStatus.textContent = user.status;
        } else {
            UI_ELEMENTS.profileViewUsername.textContent = 'ইউজার পাওয়া যায়নি';
        }
    } catch (error) {
        UI_ELEMENTS.profileViewUsername.textContent = 'ত্রুটি';
    }
}

let typingIndicatorTimer;
UI_ELEMENTS.input.addEventListener('input', () => socket.emit('typing', { room: currentRoom }));

socket.on('user typing', ({ username: typingUsername }) => {
    if (typingUsername !== username) {
        UI_ELEMENTS.typingIndicator.textContent = `${typingUsername} is typing...`;
        clearTimeout(typingIndicatorTimer);
        typingIndicatorTimer = setTimeout(() => { UI_ELEMENTS.typingIndicator.textContent = ''; }, 3000);
    }
});

// public/main.js -> socket.on('online users list', ...)
socket.on('online users list', (users) => {
    const uniqueUsers = [...new Map(users.map(item => [item.userId, item])).values()];
    const listHtml = uniqueUsers.map(user =>
        // এখানে img ট্যাগের মধ্যে class="online-user-avatar" থাকাটা জরুরি
        `<li class="online-user" data-user-id="${user.userId}">
            <img src="${user.avatar}" class="online-user-avatar" data-user-id="${user.userId}">
            <span class="online-status-dot"></span> 
            ${user.username}
        </li>`
    ).join('');
    UI_ELEMENTS.onlineUsersList.innerHTML = listHtml;

    // অনলাইন ব্যবহারকারীদের তালিকায় ক্লিক ইভেন্ট লিসেনার যোগ করা হয়েছে
    UI_ELEMENTS.onlineUsersList.addEventListener('click', (e) => {
        const targetUserElement = e.target.closest('.online-user');
        // নিশ্চিত করুন যে ক্লিকটি একটি প্রকৃত ব্যবহারকারীর আইটেমের উপর পড়েছে, তালিকার ব্যাকগ্রাউন্ডে নয়
        if (targetUserElement) {
            const userId = targetUserElement.dataset.userId;
            if (userId) { // নিশ্চিত করুন userId আছে
                showUserProfile(userId);
            }
        }
    });
});


socket.on('previous messages', (msgs) => {
    UI_ELEMENTS.messages.innerHTML = '';
    msgs.forEach(displayMessage);
});

socket.on('chat message', displayMessage);

// main.js -> socket.on('user joined', ...)

socket.on('user joined', (msg) => {
    const item = document.createElement('li');
    // নতুন: সিস্টেম মেসেজের জন্য ক্লাস যোগ করা হয়েছে
    item.classList.add('message', 'system'); 
    item.innerHTML = `<i>${msg}</i>`;
    UI_ELEMENTS.messages.appendChild(item);
});

socket.on('message edited', ({ messageId, newMessageText }) => {
    const msgLi = document.querySelector(`li[data-message-id="${messageId}"]`);
    if (msgLi) {
        const textElem = msgLi.querySelector('.message-text');
        textElem.textContent = newMessageText;
        if (newMessageText === 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
            msgLi.querySelector('.message-actions')?.remove();
        }
        if (!msgLi.querySelector('.edited-indicator')) {
            const indicator = document.createElement('small');
            indicator.className = 'edited-indicator';
            indicator.textContent = ' (edited)';
            textElem.insertAdjacentElement('afterend', indicator);
        }
    }
});

socket.on('chat cleared', () => {
    UI_ELEMENTS.messages.innerHTML = '';
    const item = document.createElement('li');
    item.classList.add('system-message');
    item.innerHTML = `<i>এই রুমের চ্যাট পরিষ্কার করা হয়েছে।</i>`;
    UI_ELEMENTS.messages.appendChild(item);
});

socket.on('avatar updated', ({ userId, avatar }) => {
    document.querySelectorAll(`img.chat-avatar[data-user-id="${userId}"]`).forEach(img => {
        img.src = avatar;
    });
    if (localStorage.getItem('userId') === userId) {
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

UI_ELEMENTS.showRoomsBtn.addEventListener('click', () => { UI_ELEMENTS.roomsModal.style.display = 'flex'; });
UI_ELEMENTS.closeButton.addEventListener('click', () => { UI_ELEMENTS.roomsModal.style.display = 'none'; });
window.addEventListener('click', (event) => { if (event.target === UI_ELEMENTS.roomsModal) UI_ELEMENTS.roomsModal.style.display = 'none'; });

UI_ELEMENTS.hamburgerMenu.addEventListener('click', () => {
    UI_ELEMENTS.sidebar.classList.add('sidebar-open');
    UI_ELEMENTS.menuOverlay.style.display = 'block';
});
UI_ELEMENTS.menuOverlay.addEventListener('click', () => {
    UI_ELEMENTS.sidebar.classList.remove('sidebar-open');
    UI_ELEMENTS.menuOverlay.style.display = 'none';
});

UI_ELEMENTS.viewProfileModalCloseBtn.addEventListener('click', () => {
    UI_ELEMENTS.viewProfileModal.style.display = 'none';
});
window.addEventListener('click', (event) => { if (event.target === UI_ELEMENTS.viewProfileModal) UI_ELEMENTS.viewProfileModal.style.display = 'none'; });