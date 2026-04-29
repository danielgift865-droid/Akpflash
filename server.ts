import * as expressModule from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import bodyParser from 'body-parser';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import authRouter from './routes/auth.ts';
import receiptsRouter from './routes/receipts.ts';
import settingsRouter from './routes/settings.ts';
import Receipt from './models/Receipt.ts';
import Settings from './models/Settings.ts';
import authMiddleware from './middleware/auth.ts';
import { sendSMS } from './src/services/smsService.ts';
import { ReceiptSchema } from './src/schemas.ts';
import { z } from 'zod';

const express = (expressModule as any).default || expressModule;

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  app.set('io', io);

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected'));
  });

  // Basic Middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // MongoDB Connection (Optional - guarded by env)
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      await mongoose.connect(mongoUri);
      console.log('Connected to MongoDB');
    } catch (err) {
      console.error('MongoDB connection error:', err);
    }
  }

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/receipts', receiptsRouter);
  app.use('/api/settings', settingsRouter);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 📄 Server-Side Receipt View (EJS)
  app.get('/receipt/:id', async (req, res) => {
    try {
      const data = await Receipt.findById(req.params.id);
      if (!data) return res.status(404).send('Receipt not found');

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const receiptUrl = `${appUrl}/receipt/${data._id}`;
      const qr = await QRCode.toDataURL(receiptUrl);

      res.render('receipt', { data, qr });
    } catch (err) {
      console.error('Error rendering receipt:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  // 📥 PDF Download Endpoint
  app.get('/receipt/:id/pdf', async (req, res) => {
    try {
      const data = await Receipt.findById(req.params.id);
      if (!data) return res.status(404).send('Receipt not found');

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt_${data.ref}.pdf`);

      doc.pipe(res);

      // PDF Content Design
      doc.rect(0, 0, 612, 150).fill('#1e293b');
      doc.fillColor('white').fontSize(24).text('TRANSACTION RECEIPT', 50, 60, { characterSpacing: 1 });
      doc.fontSize(10).text('OFFICIAL DIGITAL RECORD', 50, 95, { characterSpacing: 2 });

      doc.fillColor('#1e293b').fontSize(10).text('TRANSACTION STATUS', 400, 65);
      doc.fontSize(14).text('SUCCESSFUL', 400, 80);

      doc.moveDown(8);
      
      // Amount Section
      doc.fillColor('#64748b').fontSize(10).text('AMOUNT SENT');
      doc.fillColor('#1e293b').fontSize(28).text(`${data.amount}`);
      doc.moveDown(1);

      // Details Table
      const drawRow = (label: string, value: string) => {
        doc.fillColor('#64748b').fontSize(9).text(label, { continued: true });
        doc.fillColor('#1e293b').fontSize(10).text(`  ${value}`, { align: 'right' });
        doc.moveDown(0.5);
        doc.strokeColor('#f1f5f9').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(1);
      };

      drawRow('BENEFICIARY', data.name.toUpperCase());
      if (data.bankName) drawRow('BANK NAME', data.bankName.toUpperCase());
      if (data.accountNumber) drawRow('ACCOUNT NUMBER', data.accountNumber);
      drawRow('TRANSACTION DATE', new Date(data.createdAt).toLocaleString());
      drawRow('REFERENCE', data.ref);
      drawRow('CHANNEL', data.channel.toUpperCase());

      if (data.notes) {
        doc.fillColor('#64748b').fontSize(9).text('REMARKS:');
        doc.fillColor('#1e293b').fontSize(10).text(data.notes);
        doc.moveDown(2);
      }

      const qrBuffer = await QRCode.toBuffer(`${req.protocol}://${req.get('host')}/receipt/${data._id}`);
      doc.image(qrBuffer, 460, 580, { width: 80 });
      
      doc.fontSize(8).fillColor('#94a3b8').text('This is a secure electronic receipt generated by Apex Suite.', 50, 620);
      doc.text('Verification can be completed by scanning the QR code above.', 50, 632);

      doc.end();
    } catch (err) {
      console.error('Error generating PDF:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  // Example API routes for the requested features
  // --- Bank Resolution API (Mock) ---
  const MOCK_BANKS = [
    { name: 'Access Bank', code: '044' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'Guaranty Trust Bank', code: '058' },
    { name: 'United Bank for Africa', code: '033' },
    { name: 'Zenith Bank', code: '057' },
    { name: 'Kuda Bank', code: '50211' },
    { name: 'Opay (Digital Bank)', code: '999992' },
    { name: 'Palmpay (Digital Bank)', code: '999991' },
    { name: 'Moniepoint Microfinance', code: '50515' },
    { name: 'Stanbic IBTC Bank', code: '039' },
    { name: 'Sterling Bank', code: '232' },
    { name: 'Wema Bank', code: '035' }
  ];

  app.get('/api/banks', (req, res) => {
    res.json(MOCK_BANKS);
  });

  app.post('/api/banks/resolve', async (req, res) => {
    const { accountNumber, bankCode } = req.body;
    
    if (!accountNumber || !bankCode) {
      return res.status(400).json({ error: 'Account number and bank are required' });
    }

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Mock resolution logic
    // In a real app, you would use Paystack API: 
    // fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`)
    
    if (accountNumber.length === 10) {
      const bank = MOCK_BANKS.find(b => b.code === bankCode);
      const mockNames = ['CHIBUZOR OKECHUKWU', 'ADEWALE BABATUNDE', 'CHINONSO EZE', 'FATIMA MUSA', 'TEMITAPE ABIOLA'];
      const resolvedName = mockNames[Math.floor(Math.random() * mockNames.length)];
      
      res.json({ 
        success: true, 
        accountName: resolvedName,
        bankName: bank?.name || 'Unknown Bank'
      });
    } else {
      res.status(400).json({ error: 'Invalid account number length' });
    }
  });

  app.post('/api/receipts/create', authMiddleware, async (req, res) => {
    try {
      const validatedData = ReceiptSchema.parse(req.body);
      const receipt = new Receipt(validatedData);
      await receipt.save();

      const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
      const link = `${appUrl}/receipt/${receipt._id}`;

      // 📧 Send email
      if (receipt.email) {
        let emailUser = process.env.EMAIL_USER;
        let emailPass = process.env.EMAIL_PASS;

        // Try to get dynamic settings
        try {
          const settings = await Settings.findOne();
          if (settings?.emailUser) emailUser = settings.emailUser;
          if (settings?.emailPass) emailPass = settings.emailPass;
        } catch (err) {
          console.error('[Automation] Failed to fetch settings for email, using fallback');
        }

        if (emailUser && emailPass) {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: emailUser, pass: emailPass }
          });

          await transporter.sendMail({
            from: emailUser,
            to: receipt.email,
            subject: "Transaction Receipt",
            html: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #4f46e5;">Payment Successful</h2>
                <p>Your payment of <strong>${receipt.amount}</strong> is successful.</p>
                ${receipt.notes ? `<p style="font-size: 12px; color: #666; padding: 10px; background: #f9f9f9; border-radius: 5px;">Note: ${receipt.notes}</p>` : ''}
                <div style="margin-top: 20px;">
                  <a href="${link}" style="background: #4f46e5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Full Receipt</a>
                </div>
              </div>
            `
          });
          console.log(`[Email Automation] Receipt sent to ${receipt.email}`);
        }
      }

      // 📱 Send SMS
      if (receipt.phone) {
        const smsMessage = `Payment Successful ✔ Amount: ${receipt.amount} Ref: ${receipt.ref}. View: ${link}`;
        await sendSMS(receipt.phone, smsMessage);
        console.log(`[SMS Automation] Receipt notification sent to ${receipt.phone}`);
      }

      // 🔄 Real-time Update
      io.emit('receipt:created', receipt);

      res.json({ success: true, link, receipt });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: err.flatten().fieldErrors 
        });
      }
      console.error('Error in receipt creation task:', err);
      res.status(500).json({ error: 'Failed to create receipt or send email' });
    }
  });

  app.get('/api/generate-pdf', authMiddleware, (req, res) => {
    // Placeholder logic for pdfkit
    res.json({ message: 'PDF generation endpoint active' });
  });

  app.get('/api/generate-qr', authMiddleware, (req, res) => {
    // Placeholder logic for qrcode
    res.json({ message: 'QR generation endpoint active' });
  });

  app.post('/api/send-sms', authMiddleware, async (req, res) => {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient number and message are required' });
    }

    const result = await sendSMS(to, message);
    
    if (result.success) {
      res.json({ 
        success: true, 
        messageId: result.data?.message_id,
        gatewayResponse: result.data?.message || 'Message sent successfully'
      });
    } else {
      res.status(500).json({ error: result.error, details: result.details });
    }
  });

  app.post('/api/send-email', authMiddleware, async (req, res) => {
    const { recipient, subject, body } = req.body;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      return res.status(500).json({ error: 'Email configuration missing (EMAIL_USER/EMAIL_PASS)' });
    }

    if (!recipient || !subject || !body) {
      return res.status(400).json({ error: 'Recipient, subject, and body are required' });
    }

    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail', // Defaulting to gmail, or you can use host/port from env
        auth: {
          user: emailUser,
          pass: emailPass,
        },
      });

      const mailOptions = {
        from: emailUser,
        to: recipient,
        subject: subject,
        text: body,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email Service] Sent to ${recipient}: ${info.messageId}`);
      
      res.json({ 
        success: true, 
        messageId: info.messageId,
        info: 'Email sent successfully'
      });
    } catch (err) {
      console.error('Email send error:', err);
      res.status(500).json({ error: 'Failed to send email' });
    }
  });

  // Vite Middleware or Static Assets
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
