import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  termiiApiKey: { type: String, default: '' },
  termiiSenderId: { type: String, default: 'ApexSuite' },
  emailUser: { type: String, default: '' },
  emailPass: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
