import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './api/models/user.model.js';

dotenv.config();

async function promoteToAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_STRING);
    const user = await User.findOneAndUpdate(
      { email: 'amanjain310105@gmail.com' },
      { role: 'admin' },
      { new: true }
    );
    if (user) {
      console.log('✅ Success! User promoted to admin:', user.username);
    } else {
      console.log('❌ Error: User not found. Did you sign up yet?');
    }
  } catch (error) {
    console.error('❌ Database error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

promoteToAdmin();
