require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const mongoose = require('mongoose');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User'); // আপনার User মডেল ইম্পোর্ট করা হয়েছে
const Room = require('./models/Room'); // Room মডেল ইম্পোর্ট করা হয়েছে

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

const MESSAGES_PER_PAGE = 20;

mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB সংযুক্ত হয়েছে!'))
    .catch(err => console.error('MongoDB সংযোগে সমস্যা:', err));

const messageSchema = new mongoose.Schema({
    username: String,
    message: String,
    timestamp: String,
    room: { type: String, default: 'public' },
    userId: { type: String, required: true },
    avatar: { type: String, default: 'avatars/avatar1.png' },
    reactions: [{
        emoji: { type: String, required: true },
        userId: { type: String, required: true },
        username: { type: String, required: true }
    }],
    isGuest: { type: Boolean, default: false },
    isEdited: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, default: 'sent' },
    isEphemeral: { type: Boolean, default: false },
    ephemeralAt: { type: Date }
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.json());
app.use(express.static('public'));

const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.id;
            next();
        } catch (error) {
            console.error("JWT Verification Error:", error.message); // ডিবাগ লগ
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        if (await User.findOne({ username })) return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হচ্ছে।' });
        const user = await User.create({ username, password });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`DEBUG index.js: User registered - ${user.username}, Role: ${user.role}`); // ডিবাগ লগ
        res.status(201).json({ message: 'সফলভাবে নিবন্ধিত হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status, role: user.role, type: 'registered' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: error.message || 'সার্ভার ত্রুটি।' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        const user = await User.findOne({ username });
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'অবৈধ ইউজারনেম বা পাসওয়ার্ড।' });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`DEBUG index.js: User logged in - ${user.username}, Role: ${user.role}`); // ডিবাগ লগ
        res.status(200).json({ message: 'সফলভাবে লগইন হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status, role: user.role, type: 'registered' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: error.message || 'সার্ভার ত্রুটি।' });
    }
});

app.post('/api/user/avatar', protect, async (req, res) => {
    try {
        const { avatar } = req.body;
        const user = await User.findById(req.userId);
        if (user) {
            user.avatar = avatar;
            await user.save();

            io.of('/').sockets.forEach(s => {
                if (s.userId === user._id.toString()) {
                    s.avatar = user.avatar;
                    if (onlineUsers.has(s.id)) {
                        const userInMap = onlineUsers.get(s.id);
                        userInMap.avatar = user.avatar;
                        onlineUsers.set(s.id, userInMap);
                    }
                }
            });

            io.emit('online users list', Array.from(onlineUsers.values()));
            io.emit('avatar updated', { userId: user._id, avatar: user.avatar });
            
            res.json({ message: 'Avatar updated successfully', avatar: user.avatar });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        console.error('Avatar update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/user/status', protect, async (req, res) => {
    try {
        const { status } = req.body;
        const user = await User.findById(req.userId);
        if (user) {
            user.status = status;
            await user.save();
            res.json({ message: 'Status updated successfully', status: user.status });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

app.get('/api/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        if (userId.startsWith('guest-')) {
            const guestProfile = {
                _id: userId,
                username: `Guest-${userId.substring(6, 10)}`,
                avatar: 'avatars/avatar1.png',
                status: 'আমি একজন অতিথি ব্যবহারকারী।',
                role: 'user'
            };
            return res.json(guestProfile);
        }
        const user = await User.findById(userId).select('-password');
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('একজন ব্যবহারকারী সংযুক্ত হয়েছে (Socket ID: ' + socket.id + ')');

    socket.on('authenticate', async (data, callback) => {
        try {
            const { token, guestId } = data;
            let authUser = null;
            let authType = 'guest';

            if (token) {
                try {
                    const decoded = jwt.verify(token, JWT_SECRET);
                    authUser = await User.findById(decoded.id);
                    if (authUser) {
                        socket.userId = authUser._id.toString();
                        socket.username = authUser.username;
                        socket.avatar = authUser.avatar;
                        socket.status = authUser.status;
                        socket.role = authUser.role; // গ্লোবাল রোল সেট
                        authType = 'registered';
                    }
                } catch (jwtErr) {
                    console.warn('JWT verification failed, treating as guest.', jwtErr.message); // ডিবাগ লগ
                }
            }
            
            if (authType === 'guest') {
                socket.userId = guestId || `guest-${Math.random().toString(36).substring(2, 9)}`;
                socket.username = `Guest-${socket.userId.substring(6, 10)}`;
                socket.avatar = 'avatars/avatar1.png';
                socket.status = 'আমি একজন অতিথি ব্যবহারকারী।';
                socket.role = 'user'; // গেস্ট ইউজারের জন্য ডিফল্ট রোল
            }

            // অনলাইন ইউজারের ম্যাপে রোল ও টাইপ যোগ করা হয়েছে
            onlineUsers.set(socket.id, {
                userId: socket.userId,
                username: socket.username,
                avatar: socket.avatar,
                role: socket.role,
                type: authType
            });
            
            // io.emit করার আগে, ম্যাপের বর্তমান অবস্থা লগ করুন
            console.log("DEBUG index.js: Online users map before emit:", Array.from(onlineUsers.values())); // ডিবাগ লগ
            io.emit('online users list', Array.from(onlineUsers.values()));

            callback({
                success: true,
                username: socket.username,
                type: authType,
                userId: socket.userId,
                avatar: socket.avatar,
                status: socket.status,
                role: socket.role
            });
            console.log(`DEBUG index.js: User ${socket.username} authenticated as ${authType} with role ${socket.role}`);

        } catch (err) {
            console.error('Socket authentication error:', err);
            callback({ success: false, message: 'অথেন্টিকেশন ব্যর্থ হয়েছে।' });
        }
    });

    socket.on('join room', async (roomCode) => {
        if (!socket.userId) return;

        Array.from(socket.rooms).forEach(r => { if (r !== socket.id) socket.leave(r); });
        socket.join(roomCode);
        
        io.to(roomCode).emit('user joined', `${socket.username} ${roomCode === 'public' ? 'পাবলিক চ্যাটে' : 'রুমে'} যোগ দিয়েছে!`);
        
        try {
            const previousMessages = await Message.find({ room: roomCode })
                                                .sort({ createdAt: -1 })
                                                .limit(MESSAGES_PER_PAGE);
            socket.emit('previous messages', previousMessages.reverse());

            if (roomCode !== 'public') {
                const roomData = await Room.findOne({ name: roomCode });
                if (roomData) {
                    const member = roomData.members.find(m => m.userId.toString() === socket.userId);
                    const roomRole = member ? member.role : 'room_member'; // যদি সদস্য না থাকে, ডিফল্ট 'room_member'
                    socket.emit('room role updated', { roomCode: roomCode, role: roomRole });
                    console.log(`DEBUG index.js: User ${socket.username} joined room ${roomCode} with room role ${roomRole}`);
                } else {
                    // যদি রুম মডেলে রুম না পাওয়া যায়, ডিফল্ট রোল
                    socket.emit('room role updated', { roomCode: roomCode, role: 'room_member' });
                    console.log(`DEBUG index.js: User ${socket.username} joined non-existent room ${roomCode} (in Room model), set default role.`);
                }
            } else {
                socket.emit('room role updated', { roomCode: 'public', role: 'room_member' });
                console.log(`DEBUG index.js: User ${socket.username} joined public room, set default role.`);
            }

        } catch (err) {
            console.error('Error fetching initial messages or room data:', err);
        }
    });

    socket.on('check room existence', async (roomCode, callback) => {
        try {
            const roomExists = await Room.exists({ name: roomCode }); // Room মডেলে রুমটি বিদ্যমান কিনা চেক করা হচ্ছে
            callback(roomExists);
        } catch (error) {
            console.error('Error checking room existence:', error);
            callback(false);
        }
    });

    socket.on('create private room', async (data, callback) => {
        const { roomCode, userId, globalRole } = data; // ক্লায়েন্ট থেকে userId এবং globalRole গ্রহণ
        
        const user = await User.findById(userId);
        if (!user) {
            return callback({ success: false, message: 'রুম তৈরি করতে লগইন করুন।' });
        }

        try {
            const roomExists = await Room.exists({ name: roomCode });
            if (roomExists) {
                return callback({ success: false, message: 'এই প্রাইভেট রুম কোডটি ইতিমধ্যে ব্যবহৃত হচ্ছে। অন্য একটি ব্যবহার করুন।' });
            }

            const newRoom = new Room({
                name: roomCode,
                creator: userId,
                type: 'private',
                members: [{ userId: userId, role: 'room_admin' }] // রুম তৈরি করা ইউজার room_admin
            });
            await newRoom.save();

            const welcomeMessage = new Message({
                username: "System",
                message: `${user.username} একটি নতুন প্রাইভেট রুম "${roomCode}" তৈরি করেছে!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                room: roomCode,
                userId: "system-message",
                avatar: "avatars/avatar1.png",
                isGuest: false
            });
            await welcomeMessage.save();
            console.log(`DEBUG index.js: Room ${roomCode} created by ${user.username}. Added as room_admin.`);
            callback({ success: true, message: 'সফলভাবে নতুন প্রাইভেট রুম তৈরি হয়েছে!' });
        } catch (error) {
            console.error('Error creating private room:', error);
            callback({ success: false, message: error.message || 'রুম তৈরি করতে সার্ভার ত্রুটি হয়েছে।' });
        }
    });

    socket.on('message reaction', async ({ messageId, emoji }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            const existingReactionIndex = message.reactions.findIndex(
                r => r.userId === socket.userId && r.emoji === emoji
            );

            if (existingReactionIndex > -1) {
                message.reactions.splice(existingReactionIndex, 1);
            } else {
                message.reactions.push({
                    emoji: emoji,
                    userId: socket.userId,
                    username: socket.username
                });
            }
            
            await message.save();

            io.to(message.room).emit('reactions updated', {
                messageId: message._id,
                reactions: message.reactions
            });

        } catch (error) {
            console.error('রিয়্যাকশন যোগ করতে সমস্যা:', error);
        }
    });

    socket.on('chat message', async (data) => {
        if (!socket.userId) return;
        const { message, timestamp, room, isEphemeral, ephemeralDuration } = data;
        try {
            const newMessage = new Message({
                username: socket.username,
                message,
                timestamp,
                room,
                userId: socket.userId,
                avatar: socket.avatar,
                isGuest: socket.userId.startsWith('guest-'),
                status: 'sent',
                isEphemeral: isEphemeral,
                ephemeralAt: isEphemeral ? new Date(Date.now() + ephemeralDuration) : undefined
            });
            await newMessage.save();

            const messageToSend = newMessage.toObject();
            io.to(room).emit('chat message', messageToSend);

            newMessage.status = 'delivered';
            await newMessage.save();
            io.to(room).emit('message status updated', {
                messageId: newMessage._id,
                status: 'delivered'
            });

            if (isEphemeral) {
                setTimeout(async () => {
                    try {
                        const messageToDelete = await Message.findById(newMessage._id);
                        if (messageToDelete) {
                            await Message.deleteOne({ _id: newMessage._id });
                            io.to(room).emit('message edited', {
                                messageId: newMessage._id,
                                newMessageText: 'এই গোপন মেসেজটি স্বয়ংক্রিয়ভাবে মুছে গেছে।'
                            });
                        }
                    } catch (deleteError) {
                        console.error('ইফেমিরাল মেসেজ মুছতে সমস্যা:', deleteError);
                    }
                }, ephemeralDuration);
            }

        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    socket.on('fetch older messages', async ({ roomCode, lastMessageId }) => {
        try {
            const query = { room: roomCode };
            if (lastMessageId) {
                query._id = { $lt: lastMessageId };
            }
            
            const olderMessages = await Message.find(query)
                                            .sort({ createdAt: -1 })
                                            .limit(MESSAGES_PER_PAGE);
            
            const hasMore = olderMessages.length === MESSAGES_PER_PAGE;
            
            socket.emit('older messages', {
                messages: olderMessages.reverse(),
                hasMore: hasMore
            });
        } catch (err) {
            console.error('Error fetching older messages:', err);
        }
    });

    socket.on('message read', async ({ messageId, room }) => {
        try {
            const message = await Message.findById(messageId);
            if (message && message.status !== 'read') {
                message.status = 'read';
                await message.save();
                io.to(room).emit('message status updated', {
                    messageId: message._id,
                    status: 'read'
                });
            }
        } catch (err) {
            console.error('Error updating message read status:', err);
        }
    });

    socket.on('delete message', async ({ messageId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            if (message.userId === socket.userId) {
                message.message = 'এই মেসেজটি মুছে ফেলা হয়েছে।';
                message.isEdited = true;
                await message.save();
                io.to(message.room).emit('message edited', { messageId: message._id, newMessageText: message.message });
                return;
            }

            const isGlobalAdminOrMod = (socket.role === 'admin' || socket.role === 'moderator');
            let isRoomAdminOrMod = false;

            if (message.room !== 'public') {
                const roomData = await Room.findOne({ name: message.room });
                if (roomData) {
                    const member = roomData.members.find(m => m.userId.toString() === socket.userId);
                    if (member && (member.role === 'room_admin' || member.role === 'room_moderator')) {
                        isRoomAdminOrMod = true;
                    }
                }
            }

            if (isGlobalAdminOrMod || isRoomAdminOrMod) {
                message.message = 'এই মেসেজটি মুছে ফেলা হয়েছে।';
                message.isEdited = true;
                await message.save();
                io.to(message.room).emit('message edited', { messageId: message._id, newMessageText: message.message });
            } else {
                console.log(`DEBUG index.js: Delete failed: User ${socket.username} (Global Role: ${socket.role}) attempted to delete message ${messageId}. Global Admin/Mod: ${isGlobalAdminOrMod}, Room Admin/Mod: ${isRoomAdminOrMod}`);
                socket.emit('notification', { message: 'এই মেসেজটি ডিলিট করার অনুমতি আপনার নেই।', type: 'error' });
            }
        } catch (err) {
            console.error('Error deleting message:', err);
            socket.emit('notification', { message: 'মেসেজ ডিলিট করতে সমস্যা হয়েছে।', type: 'error' });
        }
    });

    socket.on('edit message', async ({ messageId, newMessageText }) => {
        try {
            const message = await Message.findById(messageId);
            if (message && message.userId === socket.userId && message.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
                message.message = newMessageText;
                message.isEdited = true;
                await message.save();
                io.to(message.room).emit('message edited', { messageId: message._id, newMessageText: message.message });
            } else {
                socket.emit('notification', { message: 'আপনি এই মেসেজটি সম্পাদনা করতে পারবেন না।', type: 'error' });
            }
        } catch (err) {
            console.error('Error editing message:', err);
            socket.emit('notification', { message: 'মেসেজ সম্পাদনা করতে সমস্যা হয়েছে।', type: 'error' });
        }
    });
    
    socket.on('clear room chat', async ({ roomCode }) => {
        try {
            const isGlobalAdminOrMod = (socket.role === 'admin' || socket.role === 'moderator');
            let isRoomAdminOrMod = false;

            if (roomCode !== 'public') {
                const roomData = await Room.findOne({ name: roomCode });
                if (roomData) {
                    const member = roomData.members.find(m => m.userId.toString() === socket.userId);
                    if (member && (member.role === 'room_admin' || member.role === 'room_moderator')) {
                        isRoomAdminOrMod = true;
                    }
                }
            }

            if (isGlobalAdminOrMod || isRoomAdminOrMod) {
                await Message.deleteMany({ room: roomCode });
                io.to(roomCode).emit('chat cleared');
                io.to(roomCode).emit('notification', { message: `${socket.username} দ্বারা চ্যাট পরিষ্কার করা হয়েছে।`, type: 'info' });
            } else {
                console.log(`DEBUG index.js: Clear chat failed: User ${socket.username} (Global Role: ${socket.role}). Global Admin/Mod: ${isGlobalAdminOrMod}, Room Admin/Mod: ${isRoomAdminOrMod}`);
                socket.emit('notification', { message: 'চ্যাট পরিষ্কার করার অনুমতি আপনার নেই।', type: 'error' });
            }
        } catch (err) {
            console.error('Error clearing chat:', err);
            socket.emit('notification', { message: 'চ্যাট পরিষ্কার করতে সমস্যা হয়েছে।', type: 'error' });
        }
    });

    socket.on('kick user from room', async ({ targetUserId, roomCode }) => {
        const isGlobalAdminOrMod = (socket.role === 'admin' || socket.role === 'moderator');
        let isRoomAdminOrMod = false;

        if (roomCode !== 'public') {
            const roomData = await Room.findOne({ name: roomCode });
            if (roomData) {
                const member = roomData.members.find(m => m.userId.toString() === socket.userId);
                if (member && (member.role === 'room_admin' || member.role === 'room_moderator')) {
                    isRoomAdminOrMod = true;
                }
            }
        }

        console.log(`DEBUG index.js: Kick attempt by ${socket.username} (ID: ${socket.userId}, Global Role: ${socket.role}) for ${targetUserId} in room ${roomCode}.`);
        console.log(`DEBUG index.js: Is global admin/mod? ${isGlobalAdminOrMod}. Is room admin/mod? ${isRoomAdminOrMod}.`);

        if (!isGlobalAdminOrMod && !isRoomAdminOrMod) {
            socket.emit('notification', { message: 'এই কাজটি করার অনুমতি আপনার নেই।', type: 'error' });
            return;
        }

        if (socket.userId === targetUserId) {
            socket.emit('notification', { message: 'আপনি নিজেকে রুম থেকে বের করতে পারবেন না।', type: 'error' });
            return;
        }

        let targetSocketId = null;
        let targetUsername = '';
        let foundTargetSocket = false;
        for (let [id, s] of io.of('/').sockets) {
            if (s.userId === targetUserId && s.rooms.has(roomCode)) {
                targetSocketId = id;
                targetUsername = s.username;
                foundTargetSocket = true;
                break;
            }
        }

        if (foundTargetSocket && targetSocketId) {
            const targetSocket = io.of('/').sockets.get(targetSocketId);
            targetSocket.leave(roomCode);
            targetSocket.emit('notification', { message: `আপনাকে ${roomCode} রুম থেকে বের করে দেওয়া হয়েছে।`, type: 'error' });
            targetSocket.emit('user kicked', { roomCode: roomCode, message: `আপনাকে ${roomCode} রুম থেকে বের করে দেওয়া হয়েছে।` });
            
            io.to(roomCode).emit('user left', `${targetUsername} কে ${roomCode} রুম থেকে বের করে দেওয়া হয়েছে।`);
            socket.emit('notification', { message: `${targetUsername} কে রুম থেকে বের করা সফল হয়েছে।`, type: 'success' });
            console.log(`DEBUG index.js: User ${targetUsername} (ID: ${targetUserId}) kicked from room ${roomCode} by ${socket.username}`);
        } else {
            console.log(`DEBUG index.js: Target user ${targetUserId} not found in room ${roomCode} or not online.`);
            socket.emit('notification', { message: 'ব্যবহারকারীটি এই রুমে নেই বা পাওয়া যায়নি।', type: 'error' });
        }
    });

    socket.on('typing', ({ room }) => {
        socket.to(room).emit('user typing', { username: socket.username });
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(socket.id);
        io.emit('online users list', Array.from(onlineUsers.values()));
        console.log('একজন ব্যবহারকারী সংযোগ বিচ্ছিন্ন করেছে (Socket ID: ' + socket.id + ')');
    });
});

server.listen(PORT, () => {
    console.log(`চ্যাট সার্ভার http://localhost:${PORT} এ চলছে`);
});