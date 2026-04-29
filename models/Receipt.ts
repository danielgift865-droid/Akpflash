import mongoose from 'mongoose';

export interface IReceipt extends mongoose.Document {
  amount: string;
  name: string;
  ref: string;
  channel: string;
  status: string;
  email: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  notes: string;
  date: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReceiptSchema = new mongoose.Schema({
  amount: String,
  name: String,
  ref: String,
  channel: String,
  status: { type: String, default: "Successful" },
  email: String,
  phone: String,
  bankName: String,
  accountNumber: String,
  notes: String,
  date: { type: String, default: () => new Date().toLocaleString() }
}, {
  timestamps: true
});

export default mongoose.model<IReceipt>("Receipt", ReceiptSchema);
