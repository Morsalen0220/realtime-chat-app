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
    role: { // নতুন: রোলের ফিল্ড যোগ করা হয়েছে
        type: String,
        enum: ['user', 'moderator', 'admin'], // সম্ভাব্য রোলগুলো
        default: 'user' // ডিফল্ট রোল 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// পাসওয়ার্ড হ্যাশ করার জন্য প্রি-সেভ হুক যোগ করা হয়েছে
UserSchema.pre('save', async function(next) {
    // যদি পাসওয়ার্ড ফিল্ড পরিবর্তন না হয়, তাহলে হ্যাশ করার দরকার নেই
    // অথবা যদি এটি নতুন ডকুমেন্ট হয় এবং পাসওয়ার্ড সেট করা হয়
    if (!this.isModified('password')) {
        return next();
    }
    try {
        const salt = await bcrypt.genSalt(10); // একটি সল্ট তৈরি করা
        this.password = await bcrypt.hash(this.password, salt); // পাসওয়ার্ড হ্যাশ করা
        next();
    } catch (error) {
        // হ্যাশিংয়ে কোনো সমস্যা হলে এরর হ্যান্ডেল করা
        next(error);
    }
});

// পাসওয়ার্ড ম্যাচ করার মেথড (ইউজার লগইন করার সময় হ্যাশ করা পাসওয়ার্ড চেক করার জন্য)
UserSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

module.exports = User;