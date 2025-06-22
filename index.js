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
  isGuest: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model('Message', messageSchema);

app.use(express.json());
app.use(express.static('public'));

app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    }
    try {
        const userExists = await User.findOne({ username });
        if (userExists) {
            return res.status(400).json({ message: 'এই ইউজারনেমটি ইতিমধ্যে ব্যবহৃত হচ্ছে।' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = await User.create({
            username,
            password: hashedPassword
        });
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            message: 'সফলভাবে নিবন্ধিত হয়েছে!',
            token,
            username: user.username,
            userId: user._id
        });
    } catch (error) {
        console.error('রেজিস্ট্রেশনে ত্রুটি:', error);
        res.status(500).json({ message: 'সার্ভার ত্রুটি। রেজিস্ট্রেশন ব্যর্থ হয়েছে।' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'অনুগ্রহ করে ইউজারনেম এবং পাসওয়ার্ড দিন।' });
    }
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'অবৈধ ইউজারনেম বা পাসওয়ার্ড।' });
        }
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'অবৈধ ইউজারনেম বা পাসওয়ার্ড।' });
        }
        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({
            message: 'সফলভাবে লগইন হয়েছে!',
            token,
            username: user.username,
            userId: user._id
        });
    } catch (error) {
        console.error('লগইনে ত্রুটি:', error);
        res.status(500).json({ message: 'সার্ভার ত্রুটি। লগইন ব্যর্থ হয়েছে।' });
    }
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

const onlineUsers = new Map();

io.on('connection', async (socket) => {
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
                      authType = 'registered';
                  }
              } catch (jwtErr) {
                  console.warn('JWT verification failed, treating as guest:', jwtErr.message);
              }
          }
          
          if (authType === 'guest') {
              if (guestId) {
                  socket.userId = guestId;
                  socket.username = `Guest-${guestId.substring(0, 4)}`;
              } else {
                  socket.userId = `guest-${Math.random().toString(36).substring(2, 9)}`;
                  socket.username = `Guest-${socket.userId.substring(0, 4)}`;
              }
          }

          onlineUsers.set(socket.id, { userId: socket.userId, username: socket.username });
          io.emit('online users list', Array.from(onlineUsers.values()));

          callback({ success: true, username: socket.username, type: authType, userId: socket.userId });

      } catch (err) {
          console.error('Socket authentication error:', err);
          callback({ success: false, message: 'অথেন্টিকেশন ব্যর্থ হয়েছে।' });
      }
  });


  socket.on('join room', async (roomCode) => {
    if (!socket.username || !socket.userId) {
        return socket.emit('error', 'Authentication required to join room. Please refresh and log in.');
    }

    Array.from(socket.rooms).forEach(r => {
        if (r !== socket.id) {
            socket.leave(r);
        }
    });

    socket.join(roomCode);
    console.log(`${socket.username} (${socket.userId}) রুম: ${roomCode} এ জয়েন করেছে (Socket ID: ${socket.id})`);

    io.to(roomCode).emit('user joined', `${socket.username} ${roomCode === 'public' ? 'পাবলিক চ্যাটে' : 'রুমে'} যোগ দিয়েছে!`);
    
    try {
      const previousMessages = await Message.find({ room: roomCode }).sort({ createdAt: 1 }).limit(100);
      socket.emit('previous messages', previousMessages);
    } catch (err) {
      console.error(`রুম ${roomCode} এর জন্য পূর্ববর্তী মেসেজ লোড করতে ব্যর্থ:`, err);
    }
  });

  socket.on('chat message', async (data) => {
    if (!socket.username || !socket.userId) {
        return;
    }
    const { message, timestamp, room } = data;
    try {
      const newMessage = new Message({
          username: socket.username,
          message,
          timestamp,
          room,
          userId: socket.userId,
          isGuest: socket.userId.startsWith('guest-')
      });
      await newMessage.save();
      io.to(room).emit('chat message', newMessage.toObject());
    } catch (err) {
      console.error('মেসেজ সংরক্ষণে ব্যর্থ:', err);
    }
  });

  socket.on('delete message', async ({ messageId }) => {
      try {
          const message = await Message.findById(messageId);
          if (message && message.userId === socket.userId) {
              message.message = 'এই মেসেজটি মুছে ফেলা হয়েছে।';
              message.isEdited = true;
              await message.save();
              io.to(message.room).emit('message edited', {
                  messageId: message._id,
                  newMessageText: message.message
              });
          }
      } catch (err) {
          console.error('মেসেজ ডিলিট করতে সমস্যা:', err);
      }
  });

  socket.on('edit message', async ({ messageId, newMessageText }) => {
      try {
          const message = await Message.findById(messageId);
          if (message && message.userId === socket.userId && message.message !== 'এই মেসেজটি মুছে ফেলা হয়েছে।') {
              message.message = newMessageText;
              message.isEdited = true;
              await message.save();
              io.to(message.room).emit('message edited', {
                  messageId: message._id,
                  newMessageText: message.message
              });
          }
      } catch (err) {
          console.error('মেসেজ এডিট করতে সমস্যা:', err);
      }
  });

// index.js ফাইলে যোগ করুন

socket.on('clear room chat', async ({ roomCode }) => {
    // এখানে আমরা ধরে নিচ্ছি যে কোনো ইউজারই চ্যাট ক্লিয়ার করতে পারবে।
    // ভবিষ্যতে আপনি এখানে শুধুমাত্র অ্যাডমিনদের জন্য অনুমতি দেওয়ার লজিক যোগ করতে পারেন।
    try {
        await Message.deleteMany({ room: roomCode });
        console.log(`রুম "${roomCode}" এর সব মেসেজ মুছে ফেলা হয়েছে।`);

        // রুমের সব ক্লায়েন্টকে জানিয়ে দিন যে চ্যাট ক্লিয়ার করা হয়েছে
        io.to(roomCode).emit('chat cleared');

    } catch (err) {
        console.error('চ্যাট ক্লিয়ার করতে সমস্যা:', err);
    }
});
  
  socket.on('typing', ({ room }) => {
      socket.to(room).emit('user typing', { username: socket.username });
  });

  socket.on('check room existence', async (roomCode, callback) => {
      try {
          const existingMessage = await Message.findOne({ room: roomCode });
          callback(!!existingMessage);
      } catch (err) {
          console.error('রুম অস্তিত্ব যাচাই করতে সমস্যা:', err);
          callback(false);
      }
  });

  socket.on('create private room', async (roomCode, username, callback) => {
      if (!roomCode || roomCode.length < 3 || roomCode.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(roomCode)) {
          return callback({ success: false, message: 'রুম কোডটি 3-20 অক্ষরের মধ্যে হতে হবে।' });
      }
      try {
          const existingMessage = await Message.findOne({ room: roomCode });
          if (existingMessage) {
              return callback({ success: false, message: 'এই নামের রুম আগে থেকেই বিদ্যমান।' });
          } else {
              const dummyMessage = new Message({
                  username: 'System',
                  message: `রুম "${roomCode}" ${socket.username} দ্বারা তৈরি হয়েছে।`,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  room: roomCode,
                  userId: socket.userId,
                  isGuest: socket.userId.startsWith('guest-')
              });
              await dummyMessage.save();
              callback({ success: true, message: 'রুম সফলভাবে তৈরি হয়েছে।' });
          }
      } catch (err) {
          console.error('রুম তৈরি করতে সমস্যা:', err);
          callback({ success: false, message: 'সার্ভার ত্রুটি।' });
      }
  });

  socket.on('disconnect', () => {
    console.log('একজন ব্যবহারকারী সংযোগ বিচ্ছিন্ন করেছে (Socket ID: ' + socket.id + ')');
    onlineUsers.delete(socket.id);
    io.emit('online users list', Array.from(onlineUsers.values()));
  });
});

server.listen(PORT, () => {
  console.log(`চ্যাট সার্ভার http://localhost:${PORT} এ চলছে`);
});