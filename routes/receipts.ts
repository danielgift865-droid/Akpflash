import * as expressModule from 'express';
import Receipt from '../models/Receipt.ts';
import authMiddleware from '../middleware/auth.ts';
import { ReceiptSchema } from '../src/schemas.ts';
import { z } from 'zod';

const express = (expressModule as any).default || expressModule;
const router = express.Router();

// Get all receipts (with filtering and search)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, channel, startDate, endDate, search, bankName } = req.query;
    const query: any = {};

    if (status) query.status = status;
    if (channel) query.channel = channel;
    if (bankName) query.bankName = bankName;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      query.$or = [
        { name: searchRegex },
        { ref: searchRegex },
        { amount: searchRegex }
      ];
    }

    const receipts = await Receipt.find(query).sort({ createdAt: -1 });
    res.json(receipts);
  } catch (err) {
    console.error('Error fetching receipts:', err);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Get single receipt
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const receipt = await Receipt.findById(req.params.id);
    if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
    res.json(receipt);
  } catch (err) {
    console.error('Error fetching receipt:', err);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// Create receipt
router.post('/', authMiddleware, async (req, res) => {
  try {
    const validatedData = ReceiptSchema.parse(req.body);
    const newReceipt = new Receipt(validatedData);
    const savedReceipt = await newReceipt.save();
    
    // 🔄 Real-time Update
    const io = req.app.get('io');
    if (io) io.emit('receipt:created', savedReceipt);

    res.status(201).json(savedReceipt);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: err.flatten().fieldErrors 
      });
    }
    console.error('Error creating receipt:', err);
    res.status(500).json({ error: 'Failed to create receipt' });
  }
});

// Update receipt
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const validatedData = ReceiptSchema.partial().parse(req.body);
    const updatedReceipt = await Receipt.findByIdAndUpdate(
      req.params.id,
      validatedData,
      { new: true, runValidators: true }
    );
    if (!updatedReceipt) return res.status(404).json({ error: 'Receipt not found' });

    // 🔄 Real-time Update
    const io = req.app.get('io');
    if (io) io.emit('receipt:updated', updatedReceipt);

    res.json(updatedReceipt);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: err.flatten().fieldErrors 
      });
    }
    console.error('Error updating receipt:', err);
    res.status(500).json({ error: 'Failed to update receipt' });
  }
});

// Delete receipt
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deletedReceipt = await Receipt.findByIdAndDelete(req.params.id);
    if (!deletedReceipt) return res.status(404).json({ error: 'Receipt not found' });

    // 🔄 Real-time Update
    const io = req.app.get('io');
    if (io) io.emit('receipt:deleted', { id: req.params.id });

    res.json({ message: 'Receipt deleted successfully' });
  } catch (err) {
    console.error('Error deleting receipt:', err);
    res.status(500).json({ error: 'Failed to delete receipt' });
  }
});

// Bulk Delete receipts
router.post('/bulk-delete', authMiddleware, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ error: 'Invalid or missing receipt IDs' });
    }

    await Receipt.deleteMany({ _id: { $in: ids } });

    // 🔄 Real-time Update
    const io = req.app.get('io');
    if (io) {
      ids.forEach(id => io.emit('receipt:deleted', { id }));
    }

    res.json({ message: 'Receipts deleted successfully' });
  } catch (err) {
    console.error('Error bulk deleting receipts:', err);
    res.status(500).json({ error: 'Failed to bulk delete receipts' });
  }
});

export default router;
