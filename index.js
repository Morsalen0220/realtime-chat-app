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

  // **এই অংশটি ঠিক আছে, কারণ এটি একটি অবজেক্ট গ্রহণ করে এবং ব্রডকাস্ট করে**
  socket.on('chat message', (data) => {
    // console.log(`মেসেজ (${data.username}) [${data.timestamp}]: ${data.message}`); // ডিবাগিং এর জন্য
    io.emit('chat message', data); // প্রাপ্ত অবজেক্ট (username, message, timestamp সহ) ব্রডকাস্ট করা হচ্ছে
  });
  // ----------------------------------------------------------------------

  socket.on('disconnect', () => {
    console.log('একজন ব্যবহারকারী সংযোগ বিচ্ছিন্ন করেছে');
  });
});

server.listen(PORT, () => {
  console.log(`চ্যাট সার্ভার http://localhost:${PORT} এ চলছে`);
});
