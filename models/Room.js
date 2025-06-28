// models/Room.js
const mongoose = require('mongoose');

const RoomSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        minlength: 3 // রুমের নামের সর্বনিম্ন দৈর্ঘ্য
    },
    creator: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['public', 'private'], 
        default: 'private' 
    },
    members: [{ // রুমের মেম্বারদের তালিকা এবং তাদের রোল
        userId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', 
            required: true 
        },
        role: { 
            type: String, 
            enum: ['room_member', 'room_moderator', 'room_admin'], 
            default: 'room_member' 
        },
        _id: false // MongoDB যেন স্বয়ংক্রিয়ভাবে _id যোগ না করে প্রতিটি সদস্যের জন্য
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Room', RoomSchema);