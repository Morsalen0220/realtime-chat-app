const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

io.on('connection', (socket) => {
  console.log('একজন ব্যবহারকারী সংযুক্ত হয়েছে');

  // **পরিবর্তিত অংশ: ক্লায়েন্ট থেকে আসা ডেটা এখন একটি অবজেক্ট হবে**
  socket.on('chat message', (data) => {
    console.log(`মেসেজ (${data.username}): ${data.message}`);
    // সমস্ত সংযুক্ত ক্লায়েন্টদের কাছে অবজেক্ট সহ মেসেজটি সম্প্রচার করুন
    io.emit('chat message', data);
  });
  // ---------------------------------------------------

  socket.on('disconnect', () => {
    console.log('একজন ব্যবহারকারী সংযোগ বিচ্ছিন্ন করেছে');
  });
});

server.listen(PORT, () => {
  console.log(`চ্যাট সার্ভার http://localhost:${PORT} এ চলছে`);
});