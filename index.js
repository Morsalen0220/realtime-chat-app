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
const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://Morsalen02200:62783339@chatapp.kxfe1i3.mongodb.net/?retryWrites=true&w=majority&appName=chatapp';
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_strong_secret_key_change_this_in_production';

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
        res.status(500).json({ message: 'সার্ভার ত্রুটি।' });
    }
});

app.post('/api/user/avatar', protect, async (req, res) => {
    try {
        const { avatar } = req.body;
        const user = await User.findById(req.userId);
        if (user) {
            user.avatar = avatar;
            await user.save();
            io.emit('avatar updated', { userId: user._id, avatar: user.avatar });
            res.json({ message: 'Avatar updated successfully', avatar: user.avatar });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
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
                avatar: socket.avatar,
                isGuest: socket.userId.startsWith('guest-')
            });
            await newMessage.save();
            io.to(room).emit('chat message', newMessage.toObject());
        } catch (err) {
            console.error('Error saving message:', err);
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