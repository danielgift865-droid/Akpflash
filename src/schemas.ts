import { z } from 'zod';

export const ReceiptSchema = z.object({
  amount: z.string().min(1, 'Amount is required').refine(val => !isNaN(Number(val.replace(/[^0-9.]/g, ''))), 'Invalid amount format'),
  name: z.string().min(3, 'Beneficiary name must be at least 3 characters'),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().length(10, 'Account number must be exactly 10 digits').regex(/^\d+$/, 'Account number must be numeric'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().min(10, 'Invalid phone number').optional().or(z.literal('')),
  notes: z.string().max(250, 'Notes cannot exceed 250 characters').optional().or(z.literal('')),
  status: z.enum(['Successful', 'Pending', 'Failed']).default('Successful'),
  channel: z.string().default('Transfer'),
  ref: z.string().optional()
});

export type ReceiptInput = z.infer<typeof ReceiptSchema>;
