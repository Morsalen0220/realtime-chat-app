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
const User = require('./models/User');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.DATABASE_URL; // .env থেকে লোড হবে
const JWT_SECRET = process.env.JWT_SECRET; // .env থেকে লোড হবে

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
    createdAt: { type: Date, default: Date.now }
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

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        if (await User.findOne({ username })) return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হচ্ছে।' });
        const user = await User.create({ username, password });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ message: 'সফলভাবে নিবন্ধিত হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status });
    } catch (error) {
        console.error('Registration error:', error); // রেজিস্ট্রেশন ত্রুটি লগ করুন
        res.status(500).json({ message: 'সার্ভার ত্রুটি।' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        const user = await User.findOne({ username });
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'অবৈধ ইউজারনেম বা পাসওয়ার্ড।' });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'সফলভাবে লগইন হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status });
    } catch (error) {
        console.error('Login error:', error); // লগইন ত্রুটি লগ করুন
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

            // এখানে নতুন কোড: ব্যবহারকারীর সক্রিয় সকেটের অ্যাভাটার আপডেট করা
            io.of('/').sockets.forEach(s => {
                if (s.userId === user._id.toString()) {
                    s.avatar = user.avatar; // সকেটের অ্যাভাটার প্রপার্টি আপডেট করা
                    // onlineUsers ম্যাপেও অ্যাভাটার আপডেট করা যদি প্রয়োজন হয় (যদি ম্যাপে অ্যাভাটার ব্যবহার করা হয়)
                    if (onlineUsers.has(s.id)) {
                        const userInMap = onlineUsers.get(s.id);
                        userInMap.avatar = user.avatar;
                        onlineUsers.set(s.id, userInMap);
                    }
                }
            });

            // অনলাইন ইউজারের তালিকা রি-এমিট করা (অন্যান্য ক্লায়েন্টের সাইডবার অ্যাভাটার আপডেট করার জন্য)
            io.emit('online users list', Array.from(onlineUsers.values()));
            // সমস্ত ক্লায়েন্টকে অ্যাভাটার আপডেটের ইভেন্ট পাঠানো (বিদ্যমান মেসেজের অ্যাভাটার আপডেট করার জন্য)
            io.emit('avatar updated', { userId: user._id, avatar: user.avatar });
            
            res.json({ message: 'Avatar updated successfully', avatar: user.avatar });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Avatar update error:', error); // অ্যাভাটার আপডেট ত্রুটি লগ করুন
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
        console.error('Status update error:', error); // স্ট্যাটাস আপডেট ত্রুটি লগ করুন
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
                status: 'আমি একজন অতিথি ব্যবহারকারী।'
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
        console.error('Get user profile error:', error); // ইউজার প্রোফাইল ত্রুটি লগ করুন
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
                        socket.avatar = authUser.avatar; // অথেনটিকেশনের সময় অ্যাভাটার সেট করা
                        socket.status = authUser.status;
                        authType = 'registered';
                    }
                } catch (jwtErr) {
                    console.warn('JWT verification failed, treating as guest.');
                }
            }
            
            if (authType === 'guest') {
                socket.userId = guestId || `guest-${Math.random().toString(36).substring(2, 9)}`;
                socket.username = `Guest-${socket.userId.substring(6, 10)}`;
                socket.avatar = 'avatars/avatar1.png'; // অতিথি হিসেবে অ্যাভাটার সেট করা
                socket.status = 'আমি একজন অতিথি ব্যবহারকারী।';
            }

            onlineUsers.set(socket.id, {
                userId: socket.userId,
                username: socket.username,
                avatar: socket.avatar
            });
            
            io.emit('online users list', Array.from(onlineUsers.values()));

            callback({
                success: true,
                username: socket.username,
                type: authType,
                userId: socket.userId,
                avatar: socket.avatar,
                status: socket.status
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
            const previousMessages = await Message.find({ room: roomCode }).sort({ createdAt: 1 }).limit(100);
            socket.emit('previous messages', previousMessages);
        } catch (err) {
            console.error('Error fetching messages:', err);
        }
    });

    socket.on('message reaction', async ({ messageId, emoji }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            // চেক করা হচ্ছে ইউজারটি আগে এই ইমোজি দিয়ে রিয়্যাক্ট করেছে কিনা
            const existingReactionIndex = message.reactions.findIndex(
                r => r.userId === socket.userId && r.emoji === emoji
            );

            if (existingReactionIndex > -1) {
                // যদি আগে একই রিয়্যাকশন দিয়ে থাকে, তবে সেটি তুলে নেওয়া হবে (un-react)
                message.reactions.splice(existingReactionIndex, 1);
            } else {
                // নতুন রিয়্যাকশন যোগ করা হচ্ছে
                message.reactions.push({
                    emoji: emoji,
                    userId: socket.userId,
                    username: socket.username
                });
            }
            
            await message.save();

            // রুমের সবাইকে আপডেটেড রিয়্যাকশন লিস্ট পাঠানো হচ্ছে
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
        const { message, timestamp, room } = data;
        try {
            const newMessage = new Message({
                username: socket.username,
                message,
                timestamp,
                room,
                userId: socket.userId,
                avatar: socket.avatar, // এখান থেকে সকেটের বর্তমান অ্যাভাটার নেওয়া হবে
                isGuest: socket.userId.startsWith('guest-')
            });
            await newMessage.save();
            io.to(room).emit('chat message', newMessage.toObject());
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    // রুম বিদ্যমান কিনা চেক করার জন্য
    socket.on('check room existence', async (roomCode, callback) => {
        try {
            // MongoDB তে রুমের মেসেজ আছে কিনা চেক করে
            const roomExists = await Message.exists({ room: roomCode });
            callback(roomExists);
        } catch (error) {
            console.error('Error checking room existence:', error);
            callback(false); // ত্রুটি হলে রুম বিদ্যমান নয়
        }
    });

    // নতুন প্রাইভেট রুম তৈরি করার জন্য
    socket.on('create private room', async (roomCode, username, callback) => {
        try {
            // প্রথমে রুমটি বিদ্যমান কিনা চেক করা হচ্ছে
            const roomExists = await Message.exists({ room: roomCode });
            if (roomExists) {
                return callback({ success: false, message: 'এই প্রাইভেট রুম কোডটি ইতিমধ্যে ব্যবহৃত হচ্ছে। অন্য একটি ব্যবহার করুন।' });
            }

            // একটি স্বাগত মেসেজ তৈরি করে রুমে যোগ করা হচ্ছে
            const welcomeMessage = new Message({
                username: "System",
                message: `${username} একটি নতুন প্রাইভেট রুম "${roomCode}" তৈরি করেছে!`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                room: roomCode,
                userId: "system-message", // সিস্টেম মেসেজের জন্য একটি বিশেষ userId
                avatar: "avatars/avatar1.png", // সিস্টেম মেসেজের জন্য একটি ডিফল্ট অ্যাভাটার
                isGuest: false // সিস্টেম মেসেজ গেস্ট নয়
            });
            await welcomeMessage.save();

            callback({ success: true, message: 'সফলভাবে নতুন প্রাইভেট রুম তৈরি হয়েছে!' });
        } catch (error) {
            console.error('Error creating private room:', error);
            callback({ success: false, message: 'রুম তৈরি করতে সার্ভার ত্রুটি হয়েছে।' });
        }
    });

    socket.on('delete message', async ({ messageId }) => {
        try {
            const message = await Message.findById(messageId);
            if (message && message.userId === socket.userId) {
                message.message = 'এই মেসেজটি মুছে ফেলা হয়েছে।';
                message.isEdited = true;
                await message.save();
                io.to(message.room).emit('message edited', { messageId: message._id, newMessageText: message.message });
            }
        } catch (err) { console.error('Error deleting message:', err); }
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
            await Message.deleteMany({ room: roomCode });
            io.to(roomCode).emit('chat cleared');
        } catch (err) {
            console.error('Error clearing chat:', err);
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
