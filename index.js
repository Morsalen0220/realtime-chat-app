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
const { throws } = require('assert'); // এটি সম্ভবত অপ্রয়োজনীয়, সরিয়ে দেওয়া যেতে পারে

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET;

// প্রতি পেজে কতগুলো মেসেজ লোড হবে
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
    status: { type: String, default: 'sent' }, // 'sent', 'delivered', 'read'
    isEphemeral: { type: Boolean, default: false }, // নতুন ইফেমিরাল ফিল্ড
    ephemeralAt: { type: Date } // মেসেজ কখন মুছে যাবে তার টাইমস্ট্যাম্প
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.json());
app.use(express.static('public'));

// একটি ছোট মিডলওয়্যার যা JWT টোকেন ভেরিফাই করবে
const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.id;
            next();
        } catch (error) {
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// রেজিস্ট্রেশন রুট
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        if (await User.findOne({ username })) return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হচ্ছে।' });
        const user = await User.create({ username, password });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        // নতুন: রেজিস্ট্রেশনের সময় ইউজারের রোল পাঠানো হচ্ছে
        res.status(201).json({ message: 'সফলভাবে নিবন্ধিত হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status, role: user.role });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'সার্ভার ত্রুটি।' });
    }
});

// লগইন রুট
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        const user = await User.findOne({ username });
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'অবৈধ ইউজারনেম বা পাসওয়ার্ড।' });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        // নতুন: লগইনের সময় ইউজারের রোল পাঠানো হচ্ছে
        res.status(200).json({ message: 'সফলভাবে লগইন হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status, role: user.role });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'সার্ভার ত্রুটি।' });
    }
});

// অ্যাভাটার পরিবর্তন হ্যান্ডেল করার রুট
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
    } catch (error) {
        console.error('Avatar update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// স্ট্যাটাস পরিবর্তন হ্যান্ডেল করার রুট
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

// ইউজারের প্রোফাইল তথ্য আনার রুট
app.get('/api/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        if (userId.startsWith('guest-')) {
            const guestProfile = {
                _id: userId,
                username: `Guest-${userId.substring(6, 10)}`,
                avatar: 'avatars/avatar1.png',
                status: 'আমি একজন অতিথি ব্যবহারকারী।',
                role: 'user' // গেস্ট ব্যবহারকারীদের জন্য ডিফল্ট রোল
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
                        socket.role = authUser.role; // নতুন: অথেনটিকেশনের সময় ইউজারের রোল সকেটে সেট করা
                        authType = 'registered';
                    }
                } catch (jwtErr) {
                    console.warn('JWT verification failed, treating as guest.');
                }
            }
            
            if (authType === 'guest') {
                socket.userId = guestId || `guest-${Math.random().toString(36).substring(2, 9)}`;
                socket.username = `Guest-${socket.userId.substring(6, 10)}`;
                socket.avatar = 'avatars/avatar1.png';
                socket.status = 'আমি একজন অতিথি ব্যবহারকারী।';
                socket.role = 'user'; // গেস্ট ইউজারের জন্য ডিফল্ট রোল
            }

            onlineUsers.set(socket.id, {
                userId: socket.userId,
                username: socket.username,
                avatar: socket.avatar,
                role: socket.role // নতুন: অনলাইন ইউজারের ম্যাপে রোল যোগ করা
            });
            
            io.emit('online users list', Array.from(onlineUsers.values()));

            callback({
                success: true,
                username: socket.username,
                type: authType,
                userId: socket.userId,
                avatar: socket.avatar,
                status: socket.status,
                role: socket.role // নতুন: অথেনটিকেশন কলব্যাকে রোল পাঠানো
            });
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
        } catch (err) {
            console.error('Error fetching initial messages:', err);
        }
    });

    // রুম বিদ্যমান কিনা চেক করার জন্য
    socket.on('check room existence', async (roomCode, callback) => {
        try {
            const roomExists = await Message.exists({ room: roomCode });
            callback(roomExists);
        } catch (error) {
            console.error('Error checking room existence:', error);
            callback(false);
        }
    });

    // নতুন প্রাইভেট রুম তৈরি করার জন্য
    socket.on('create private room', async (roomCode, username, callback) => {
        try {
            const roomExists = await Message.exists({ room: roomCode });
            if (roomExists) {
                return callback({ success: false, message: 'এই প্রাইভেট রুম কোডটি ইতিমধ্যে ব্যবহৃত হচ্ছে। অন্য একটি ব্যবহার করুন।' });
            }

            const welcomeMessage = new Message({
                username: "System",
                message: `${username} একটি নতুন প্রাইভেট রুম "${roomCode}" তৈরি করেছে!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                room: roomCode,
                userId: "system-message",
                avatar: "avatars/avatar1.png",
                isGuest: false
            });
            await welcomeMessage.save();
            callback({ success: true, message: 'সফলভাবে নতুন প্রাইভেট রুম তৈরি হয়েছে!' });
        } catch (error) {
            console.error('Error creating private room:', error);
            callback({ success: false, message: 'রুম তৈরি করতে সার্ভার ত্রুটি হয়েছে।' });
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

    // নতুন Socket.IO ইভেন্ট: পুরোনো মেসেজ লোড করার জন্য
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

    // আপডেট করা হয়েছে: মেসেজ ডিলিট লজিক (রোল চেক সহ)
    socket.on('delete message', async ({ messageId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            // যদি মেসেজটি নিজের হয় OR অনুরোধকারীর রোল অ্যাডমিন/মডারেটর হয়
            if (message.userId === socket.userId || socket.role === 'admin' || socket.role === 'moderator') {
                // শুধুমাত্র মেসেজ টেক্সট পরিবর্তন করুন, পুরোপুরি মুছবেন না
                message.message = 'এই মেসেজটি মুছে ফেলা হয়েছে।';
                message.isEdited = true;
                await message.save();
                io.to(message.room).emit('message edited', { messageId: message._id, newMessageText: message.message });
            } else {
                console.log(`User ${socket.username} (Role: ${socket.role}) attempted to delete message ${messageId} but is not authorized.`);
                // ক্লায়েন্টকে একটি এরর নোটিফিকেশন পাঠাতে পারেন
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
            }
        } catch (err) { console.error('Error editing message:', err); }
    });
    
    socket.on('clear room chat', async ({ roomCode }) => {
        try {
            // রুমের চ্যাট পরিষ্কার করার জন্য অ্যাডমিন/মডারেটর রোল চেক
            if (socket.role !== 'admin' && socket.role !== 'moderator') {
                socket.emit('notification', { message: 'চ্যাট পরিষ্কার করার অনুমতি আপনার নেই।', type: 'error' });
                return;
            }
            await Message.deleteMany({ room: roomCode });
            io.to(roomCode).emit('chat cleared');
            io.to(roomCode).emit('notification', { message: `${socket.username} দ্বারা চ্যাট পরিষ্কার করা হয়েছে।`, type: 'info' });
        } catch (err) {
            console.error('Error clearing chat:', err);
            socket.emit('notification', { message: 'চ্যাট পরিষ্কার করতে সমস্যা হয়েছে।', type: 'error' });
        }
    });

    // নতুন: ব্যবহারকারীকে রুম থেকে বের করে দেওয়ার ইভেন্ট (শুধুমাত্র অ্যাডমিন/মডারেটরদের জন্য)
    socket.on('kick user from room', async ({ targetUserId, roomCode }) => {
        // অনুরোধকারী ইউজারের রোল চেক করা
        if (socket.role !== 'admin' && socket.role !== 'moderator') {
            socket.emit('notification', { message: 'এই কাজটি করার অনুমতি আপনার নেই।', type: 'error' });
            return;
        }

        // নিজের আইডি দিয়ে নিজেকে কিক করা যাবে না
        if (socket.userId === targetUserId) {
            socket.emit('notification', { message: 'আপনি নিজেকে রুম থেকে বের করতে পারবেন না।', type: 'error' });
            return;
        }

        let targetSocketId = null;
        let targetUsername = '';
        for (let [id, s] of io.of('/').sockets) {
            if (s.userId === targetUserId && s.rooms.has(roomCode)) {
                targetSocketId = id;
                targetUsername = s.username;
                break;
            }
        }

        if (targetSocketId) {
            const targetSocket = io.of('/').sockets.get(targetSocketId);
            targetSocket.leave(roomCode);
            targetSocket.emit('notification', { message: `আপনাকে ${roomCode} রুম থেকে বের করে দেওয়া হয়েছে।`, type: 'error' }); // Error type for more visual emphasis
            targetSocket.emit('user kicked', { roomCode: roomCode, message: `আপনাকে ${roomCode} রুম থেকে বের করে দেওয়া হয়েছে।` });
            
            io.to(roomCode).emit('user left', `${targetUsername} কে ${roomCode} রুম থেকে বের করে দেওয়া হয়েছে।`);
            socket.emit('notification', { message: `${targetUsername} কে রুম থেকে বের করা সফল হয়েছে।`, type: 'success' });
            console.log(`User ${targetUsername} (ID: ${targetUserId}) kicked from room ${roomCode} by ${socket.username}`);
        } else {
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