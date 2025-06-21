const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const mongoose = require('mongoose'); // Mongoose ইম্পোর্ট করুন

const PORT = process.env.PORT || 3000;

// MongoDB কানেকশন স্ট্রিং।
// এটিকে রেন্ডারে Environment Variable হিসেবে সেট করা উচিত (DATABASE_URL নামে)।
const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://Morsalen02200:62783339@chatapp.kxfe1i3.mongodb.net/?retryWrites=true&w=majority&appName=chatapp';
// <username> এবং <password> আপনার MongoDB Atlas এর ইউজার ও পাসওয়ার্ড দিয়ে পরিবর্তন করুন
// 'chat_app_db' আপনার ডেটাবেসের নাম

// MongoDB এর সাথে সংযোগ স্থাপন
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true, // পুরানো পার্সার ওয়ার্নিং এড়ানোর জন্য
  useUnifiedTopology: true, // পুরানো টপোলজি ইঞ্জিন ওয়ার্নিং এড়ানোর জন্য
})
.then(() => console.log('MongoDB সংযুক্ত হয়েছে!'))
.catch(err => console.error('MongoDB সংযোগে সমস্যা:', err));

// মেসেজ স্কিমা এবং মডেল তৈরি করুন
const messageSchema = new mongoose.Schema({
  username: String,
  message: String,
  timestamp: String,
  createdAt: { type: Date, default: Date.now } // মেসেজ তৈরির সময়
});
const Message = mongoose.model('Message', messageSchema); // 'Message' নামে মডেল তৈরি

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Socket.IO সংযোগ হ্যান্ডেল করুন
io.on('connection', async (socket) => {
  console.log('একজন ব্যবহারকারী সংযুক্ত হয়েছে');

  try {
    // নতুন ইউজার সংযোগ করলে বা রিলোড করলে পূর্বের মেসেজগুলো লোড করে পাঠান
    const previousMessages = await Message.find().sort({ createdAt: 1 }).limit(100); // সর্বশেষ 100টি মেসেজ লোড করুন
    socket.emit('previous messages', previousMessages); // ক্লায়েন্টের কাছে পাঠান
  } catch (err) {
    console.error('পূর্ববর্তী মেসেজ লোড করতে ব্যর্থ:', err);
  }

  // ক্লায়েন্ট থেকে 'chat message' ইভেন্ট শুনুন
  socket.on('chat message', async (data) => {
    console.log(`মেসেজ (${data.username}) [${data.timestamp}]: ${data.message}`);

    try {
      // মেসেজটি ডেটাবেসে সংরক্ষণ করুন
      const newMessage = new Message(data);
      await newMessage.save();
      console.log('মেসেজ ডেটাবেসে সংরক্ষিত হয়েছে:', newMessage);
    } catch (err) {
      console.error('মেসেজ সংরক্ষণে ব্যর্থ:', err);
    }

    // সমস্ত সংযুক্ত ক্লায়েন্টদের কাছে মেসেজটি সম্প্রচার করুন
    io.emit('chat message', data);
  });

  // যখন একজন ব্যবহারকারী সংযোগ বিচ্ছিন্ন করে
  socket.on('disconnect', () => {
    console.log('একজন ব্যবহারকারী সংযোগ বিচ্ছিন্ন করেছে');
  });
});

// সার্ভার চালু করুন
server.listen(PORT, () => {
  console.log(`চ্যাট সার্ভার http://localhost:${PORT} এ চলছে`);
});