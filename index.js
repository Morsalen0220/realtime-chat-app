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
const MONGODB_URI = process.env.DATABASE_URL; // .env ফাইলে DATABASE_URL ব্যবহার করা হয়েছে
const JWT_SECRET = process.env.JWT_SECRET;

const MESSAGES_PER_PAGE = 20;

// MongoDB সংযোগ
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB সংযুক্ত হয়েছে!'))
    .catch(err => console.error('MongoDB সংযোগে সমস্যা:', err));

// মেসেজ স্কিমা এবং মডেল
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

app.use(express.json()); // JSON বডি পার্স করার জন্য
app.use(express.static('public')); // 'public' ফোল্ডার থেকে স্ট্যাটিক ফাইল সার্ভ করার জন্য

// অথেন্টিকেশন মিডলওয়্যার
const protect = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.id; // ডিকোড করা ইউজার আইডি রিকোয়েস্ট অবজেক্টে যোগ করা
            next();
        } catch (error) {
            console.error("JWT Verification Error:", error.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

// API রাউটস

// রেজিস্ট্রেশন রাউট
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        if (await User.findOne({ username })) return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হচ্ছে।' });
        const user = await User.create({ username, password });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`DEBUG index.js: User registered - ${user.username}, Role: ${user.role}`);
        res.status(201).json({ message: 'সফলভাবে নিবন্ধিত হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status, role: user.role, type: 'registered' });
    } catch (error) {
        console.error('Registration error:', error.message); // ডিবাগিং এর জন্য error.message
        res.status(500).json({ message: error.message || 'সার্ভার ত্রুটি।' });
    }
});

// লগইন রাউট
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    try {
        const user = await User.findOne({ username });
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'অবৈধ ইউজারনেম বা পাসওয়ার্ড।' });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        console.log(`DEBUG index.js: User logged in - ${user.username}, Role: ${user.role}`);
        res.status(200).json({ message: 'সফলভাবে লগইন হয়েছে!', token, username: user.username, userId: user._id, avatar: user.avatar, status: user.status, role: user.role, type: 'registered' });
    } catch (error) {
        console.error('Login error:', error.message); // ডিবাগিং এর জন্য error.message
        res.status(500).json({ message: error.message || 'সার্ভার ত্রুটি।' });
    }
});

// অ্যাভাটার আপডেট রাউট (প্রোটেক্টেড)
app.post('/api/user/avatar', protect, async (req, res) => {
    try {
        const { avatar } = req.body;
        // console.log(`DEBUG: User ${req.userId} attempting to update avatar to ${avatar}`); // ডিবাগ লগ
        const user = await User.findById(req.userId);
        if (user) {
            user.avatar = avatar;
            await user.save();

            // সকল সকেটের জন্য অ্যাভাটার আপডেট করা
            io.of('/').sockets.forEach(s => {
                if (s.userId === user._id.toString()) {
                    s.avatar = user.avatar;
                    // অনলাইন ইউজার ম্যাপ আপডেট করা যদি এটি ক্লায়েন্টদের কাছে পাঠানো হয়
                    const userInMap = onlineUsers.get(s.id);
                    if (userInMap) {
                        userInMap.avatar = user.avatar;
                        onlineUsers.set(s.id, userInMap);
                    }
                }
            });
            io.emit('online users list', Array.from(onlineUsers.values())); // অনলাইন ইউজার লিস্ট আপডেট করা
            io.emit('avatar updated', { userId: user._id, avatar: user.avatar }); // সকল ক্লায়েন্টকে জানানো
            
            res.json({ message: 'Avatar updated successfully', avatar: user.avatar });
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    }
    catch (error) {
        console.error('Avatar update API error:', error.message);
        res.status(500).json({ message: 'Server error during avatar update: ' + error.message });
    }
});
// Private Chat (1-to-1) Route - /api/private-chat
// এটি লগইন করা ইউজার এবং অন্য একজন টার্গেট ইউজারের মধ্যে প্রাইভেট চ্যাট রুম তৈরি/খুঁজে বের করবে
app.post('/api/private-chat', protect, async (req, res) => {
    const { targetUserId } = req.body; // যাকে মেসেজ পাঠানো হচ্ছে তার আইডি
    const currentUserId = req.userId; // যে মেসেজ পাঠাচ্ছে তার আইডি

    if (currentUserId === targetUserId) {
        return res.status(400).json({ message: 'আপনি নিজের সাথে চ্যাট শুরু করতে পারবেন না।' });
    }

    try {
        // এমন একটি রুম খোঁজা যেখানে শুধুমাত্র এই দুজন মেম্বার আছে
        let chatRoom = await Room.findOne({
            type: 'private_one_to_one',
            'members.userId': { $all: [currentUserId, targetUserId] },
            'members': { $size: 2 } // নিশ্চিত করতে যে রুমে শুধু এই দুজনই আছে
        });

        if (!chatRoom) {
            // যদি রুম না পাওয়া যায়, তাহলে নতুন রুম তৈরি করুন
            const currentUser = await User.findById(currentUserId);
            const targetUser = await User.findById(targetUserId);

            if (!currentUser || !targetUser) {
                return res.status(404).json({ message: 'ব্যবহারকারী খুঁজে পাওয়া যায়নি।' });
            }

            // রুমের একটি ইউনিক নাম তৈরি করা (যেমন userId1_userId2)
            const roomName = [currentUserId, targetUserId].sort().join('_'); // আইডিগুলো সর্ট করে একটি ধারাবাহিক নাম তৈরি করবে

            chatRoom = new Room({
                name: roomName, // এই নামটি একটি আইডি হিসেবে কাজ করবে
                creator: currentUserId,
                type: 'private_one_to_one',
                members: [
                    { userId: currentUserId, role: 'room_member' },
                    { userId: targetUserId, role: 'room_member' }
                ]
            });
            await chatRoom.save();

            // সিস্টেমে একটি স্বাগত মেসেজ যোগ করা
            const welcomeMessage = new Message({
                username: "System",
                message: `${currentUser.username} এবং ${targetUser.username} এর মধ্যে একটি ব্যক্তিগত চ্যাট শুরু হয়েছে।`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                room: roomName, // প্রাইভেট চ্যাট রুমের নাম ব্যবহার
                userId: "system-message",
                avatar: "avatars/avatar1.png",
                isGuest: false
            });
            await welcomeMessage.save();

            console.log(`DEBUG index.js: New private chat room '${roomName}' created between ${currentUser.username} and ${targetUser.username}.`);
        } else {
            console.log(`DEBUG index.js: Existing private chat room '${chatRoom.name}' found.`);
        }

        res.status(200).json({
            success: true,
            message: 'প্রাইভেট চ্যাট রুম প্রস্তুত।',
            roomCode: chatRoom.name // ক্লায়েন্টকে রুমের কোড ফেরত দেওয়া
        });

    } catch (error) {
        console.error('Error in /api/private-chat:', error.message);
        res.status(500).json({ message: 'ব্যক্তিগত চ্যাট শুরু করতে সমস্যা হয়েছে: ' + error.message });
    }
});

// স্ট্যাটাস আপডেট রাউট (প্রোটেক্টেড)
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
        console.error('Status update API error:', error.message);
        res.status(500).json({ message: 'Server error during status update: ' + error.message });
    }
});

// একক ইউজারের প্রোফাইল তথ্য আনার রাউট
app.get('/api/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        // যদি গেস্ট ইউজার হয়, ডিফল্ট প্রোফাইল তথ্য ফেরত দিন
        if (userId.startsWith('guest-')) {
            const guestProfile = {
                _id: userId,
                username: `Guest-${userId.substring(6, 10)}`, // আইডি থেকে একটি ছোট অংশ
                avatar: 'avatars/avatar1.png',
                status: 'আমি একজন অতিথি ব্যবহারকারী।',
                role: 'user', // গেস্টদের জন্য ডিফল্ট রোল
                createdAt: new Date() // গেস্টদের জন্য একটি অস্থায়ী তারিখ
            };
            return res.json(guestProfile);
        }
        // রেজিস্টার্ড ইউজারের জন্য ডেটাবেস থেকে তথ্য আনুন
        const user = await User.findById(userId).select('-password'); // পাসওয়ার্ড ছাড়া ইউজার তথ্য
        if (user) {
            res.json(user);
        } else {
            res.status(404).json({ message: 'User not found' });
        }
    } catch (error) {
        console.error('Get user profile API error:', error.message);
        res.status(500).json({ message: 'Server Error fetching user profile: ' + error.message });
    }
});

// স্ট্যাটিক ফাইল সার্ভিং
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// প্রোফাইল পেজ সার্ভ করার জন্য নতুন রুট
app.get('/profile', (req, res) => {
    res.sendFile(__dirname + '/public/profile.html');
});



// Socket.IO লজিক
const onlineUsers = new Map(); // বর্তমানে অনলাইন থাকা ইউজারদের ম্যাপ
const unreadMessages = new Map(); // অপঠিত মেসেজের সংখ্যা ট্র্যাক করার জন্য

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
                    console.warn('JWT verification failed, treating as guest.', jwtErr.message);
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
            
            console.log("DEBUG index.js: Online users map before emit:", Array.from(onlineUsers.values()));
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
            console.error('Socket authentication error:', err.message);
            callback({ success: false, message: 'অথেন্টিকেশন ব্যর্থ হয়েছে।' });
        }
    });

    socket.on('join room', async (roomCode) => {
        if (!socket.userId) {
            console.log(`DEBUG: User (socket.id: ${socket.id}) attempted to join room without userId.`);
            return; // যদি ইউজার অথেন্টিকেটেড না থাকে
        }

        Array.from(socket.rooms).forEach(r => { if (r !== socket.id) socket.leave(r); });
        socket.join(roomCode);

        // রুমে যোগদানের সময় অপঠিত মেসেজের সংখ্যা রিসেট করুন
        if (unreadMessages.has(socket.userId) && unreadMessages.get(socket.userId)[roomCode]) {
            unreadMessages.get(socket.userId)[roomCode] = 0;
            socket.emit('unread count updated', unreadMessages.get(socket.userId));
        }
        
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
            console.error('Error fetching initial messages or room data:', err.message);
        }
    });

    socket.on('check room existence', async (roomCode, callback) => {
        try {
            const roomExists = await Room.exists({ name: roomCode }); // Room মডেলে রুমটি বিদ্যমান কিনা চেক করা হচ্ছে
            callback(roomExists);
        } catch (error) {
            console.error('Error checking room existence:', error.message);
            callback(false);
        }
    });

    socket.on('create private room', async (data, callback) => {
		
		
        const { roomCode, userId, globalRole } = data; // ক্লায়েন্ট থেকে userId এবং globalRole গ্রহণ
		

    // নতুন কোড: গেস্ট ইউজারদের রুম তৈরি করা থেকে বিরত রাখা
    if (userId && userId.startsWith('guest-')) {
        return callback({ success: false, message: 'অতিথি ব্যবহারকারীরা প্রাইভেট রুম তৈরি করতে পারবেন না। অনুগ্রহ করে রেজিস্টার করুন।' });
    }

    const user = await User.findById(userId); // এখানে সমস্যা হচ্ছিলো
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
            console.error('Error creating private room:', error.message);
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
            console.error('রিয়্যাকশন যোগ করতে সমস্যা:', error.message);
        }
    });

    socket.on('chat message', async (data) => {
        if (!socket.userId) {
            console.log(`DEBUG: User (socket.id: ${socket.id}) attempted to send message without userId.`);
            return;
        }
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

            // ব্যক্তিগত মেসেজের জন্য নোটিফিকেশন পাঠানোর লজিক
            try {
                const roomData = await Room.findOne({ name: room });
                if (roomData && (roomData.type === 'private_one_to_one' || roomData.type === 'private')) {
                    const otherMembers = roomData.members.filter(member => member.userId.toString() !== socket.userId);

                    for (const member of otherMembers) {
                        const recipientId = member.userId.toString();
                        // অনলাইন ব্যবহারকারীদের মধ্যে প্রাপককে খুঁজুন এবং নোটিফিকেশন পাঠান
                        for (const [id, targetSocket] of io.of('/').sockets) {
                            if (targetSocket.userId === recipientId && !targetSocket.rooms.has(room)) {
                                if (!unreadMessages.has(recipientId)) {
                                    unreadMessages.set(recipientId, {});
                                }
                                if (!unreadMessages.get(recipientId)[room]) {
                                    unreadMessages.get(recipientId)[room] = 0;
                                }
                                unreadMessages.get(recipientId)[room]++;
                                targetSocket.emit('unread count updated', unreadMessages.get(recipientId));

                                targetSocket.emit('private message notification', {
                                    from: socket.username,
                                    fromUserId: socket.userId,
                                    room: room,
                                    message: message // মূল মেসেজটি নোটিফিকেশনে যোগ করা হয়েছে
                                });
                                console.log(`DEBUG: Sent notification to ${targetSocket.username} from ${socket.username} for room ${room}.`);
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error sending private message notification:', error.message);
            }


            // স্ট্যাটাস আপডেট লজিক এখানে থাকতে পারে বা ক্লায়েন্টের উপর নির্ভর করে
            // newMessage.status = 'delivered';
            // await newMessage.save();
            // io.to(room).emit('message status updated', {
            //     messageId: newMessage._id,
            //     status: 'delivered'
            // });

            if (isEphemeral) {
                setTimeout(async () => {
                    try {
                        const messageToDelete = await Message.findById(newMessage._id);
                        if (messageToDelete && messageToDelete.isEphemeral) { // নিশ্চিত করুন এটি এখনও ephemeral আছে
                            await Message.deleteOne({ _id: newMessage._id });
                            io.to(room).emit('message edited', { // মেসেজ মুছার পর UI তে আপডেট
                                messageId: newMessage._id,
                                newMessageText: 'এই গোপন মেসেজটি স্বয়ংক্রিয়ভাবে মুছে গেছে।'
                            });
                        }
                    } catch (deleteError) {
                        console.error('ইফেমিরাল মেসেজ মুছতে সমস্যা:', deleteError.message);
                    }
                }, ephemeralDuration);
            }

        } catch (err) {
            console.error('Error saving message:', err.message);
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
            console.error('Error fetching older messages:', err.message);
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
            console.error('Error updating message read status:', err.message);
        }
    });

    socket.on('delete message', async ({ messageId }) => {
        try {
            const message = await Message.findById(messageId);
            if (!message) return;

            // মেসেজ নিজের কিনা, বা গ্লোবাল অ্যাডমিন/মডারেটর কিনা
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
            console.error('Error deleting message:', err.message);
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
            console.error('Error editing message:', err.message);
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
            console.error('Error clearing chat:', err.message);
            socket.emit('notification', { message: 'চ্যাট পরিষ্কার করতে সমস্যা হয়েছে।', type: 'error' });
        }
    });

    socket.on('kick user from room', async ({ targetUserId, roomCode }) => {
        const isGlobalAdminOrMod = (socket.role === 'admin' || socket.role === 'moderator');
        let isRoomAdminOrMod = false;

        // নিজের আইডিকে কিক করা যাবে না
        if (socket.userId === targetUserId) {
            socket.emit('notification', { message: 'আপনি নিজেকে রুম থেকে বের করতে পারবেন না।', type: 'error' });
            return;
        }

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

        let targetSocketId = null;
        let targetUsername = '';
        let foundTargetSocket = false;
        // বর্তমানে অনলাইন থাকা সকেটগুলোর মধ্যে টার্গেট ইউজারকে খুঁজে বের করা
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