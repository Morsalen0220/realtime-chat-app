const mongoose = require('mongoose'); // Add this line

const RoomSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true, 
        trim: true,
        minlength: 3 
    },
    creator: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    type: { 
        type: String, 
        enum: ['public', 'private', 'private_one_to_one'], // 'private_one_to_one' যোগ করা হয়েছে
        default: 'private' 
    },
    members: [{ 
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
        _id: false 
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

module.exports = mongoose.model('Room', RoomSchema);