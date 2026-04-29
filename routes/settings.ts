import * as expressModule from 'express';
import Settings from '../models/Settings.ts';
import authMiddleware from '../middleware/auth.ts';

const express = (expressModule as any).default || expressModule;
const router = express.Router();

// Get settings
router.get('/', authMiddleware, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        termiiApiKey: process.env.TERMII_API_KEY || '',
        termiiSenderId: process.env.TERMII_SENDER_ID || 'ApexSuite',
        emailUser: process.env.EMAIL_USER || '',
        emailPass: process.env.EMAIL_PASS || ''
      });
    }
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { termiiApiKey, termiiSenderId, emailUser, emailPass } = req.body;
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    if (termiiApiKey !== undefined) settings.termiiApiKey = termiiApiKey;
    if (termiiSenderId !== undefined) settings.termiiSenderId = termiiSenderId;
    if (emailUser !== undefined) settings.emailUser = emailUser;
    if (emailPass !== undefined) settings.emailPass = emailPass;
    
    settings.updatedAt = new Date();
    await settings.save();
    
    res.json({ success: true, settings });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
