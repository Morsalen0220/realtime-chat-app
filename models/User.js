const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // bcryptjs ইম্পোর্ট করুন

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true, // স্পেস ডিলিট করার জন্য
        minlength: 3 // সর্বনিম্ন 3 অক্ষর
    },
    password: {
        type: String,
        required: true,
        minlength: 6 // সর্বনিম্ন 6 অক্ষর
    },
	avatar: {
        type: String,
        default: 'avatars/avatar1.png' // ডিফল্ট অ্যাভাটার
    },
	status: {
        type: String,
        default: 'Hey there! I am using this chat app.',
        maxlength: 150
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// পাসওয়ার্ড ম্যাচ করার মেথড (ইউজার লগইন করার সময় হ্যাশ করা পাসওয়ার্ড চেক করার জন্য)
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;