/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { z } from 'zod';
import { ReceiptSchema } from './schemas.ts';
import { 
  ShieldCheck, 
  FileText, 
  QrCode, 
  Mail, 
  Database, 
  Settings, 
  Activity,
  ChevronRight,
  LogOut,
  Bell,
  Search,
  Filter,
  X,
  CheckCircle,
  Loader2,
  ChevronDown,
  Trash2,
  Download,
  Square,
  CheckSquare
} from 'lucide-react';

interface Receipt {
  _id: string;
  name: string;
  amount: string;
  ref: string;
  status: string;
  notes: string;
  date: string;
}

export default function App() {
  const [health, setHealth] = useState<{ status: string; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [bankFilter, setBankFilter] = useState('');
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [fetchingReceipts, setFetchingReceipts] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const fetchReceipts = useCallback(() => {
    setFetchingReceipts(true);
    const params = new URLSearchParams();
    if (searchQuery) params.append('search', searchQuery);
    if (bankFilter) params.append('bankName', bankFilter);

    fetch(`/api/receipts?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setReceipts(data);
        setFetchingReceipts(false);
      })
      .catch(err => {
        console.error('Failed to fetch receipts:', err);
        setFetchingReceipts(false);
      });
  }, [searchQuery, bankFilter]);

  useEffect(() => {
    // 🔌 Initialize Socket
    const socket = io();

    socket.on('connect', () => {
      console.log('Connected to real-time server');
    });

    socket.on('receipt:created', (newReceipt) => {
      console.log('New receipt received:', newReceipt);
      fetchReceipts(); 
    });

    socket.on('receipt:updated', (updatedReceipt) => {
      console.log('Receipt updated:', updatedReceipt);
      fetchReceipts();
    });

    socket.on('receipt:deleted', (data) => {
      console.log('Receipt deleted:', data.id);
      fetchReceipts();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchReceipts]);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setHealth(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch health:', err);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    fetch('/api/banks')
      .then(res => res.json())
      .then(data => setBanks(data));
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.length === receipts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(receipts.map(r => r._id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} receipts?`)) return;
    
    setIsBulkDeleting(true);
    try {
      const res = await fetch('/api/receipts/bulk-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ids: selectedIds })
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchReceipts();
      }
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkExport = () => {
    const selectedData = receipts.filter(r => selectedIds.includes(r._id));
    const headers = ['Name', 'Amount', 'Reference', 'Status', 'Date', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...selectedData.map(r => [
        `"${r.name}"`,
        `"${r.amount}"`,
        `"${r.ref}"`,
        `"${r.status}"`,
        `"${new Date(r.date).toLocaleDateString()}"`,
        `"${r.notes?.replace(/"/g, '""') || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `receipts_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-64 bg-white border-right border-slate-200 hidden lg:flex flex-col z-50">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ShieldCheck size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight">Apex Suite</span>
          </div>
          
          <nav className="space-y-1">
            <NavItem icon={<Activity size={18} />} label="Overview" active />
            <NavItem icon={<Database size={18} />} label="Database" />
            <NavItem icon={<FileText size={18} />} label="Documents" />
            <NavItem icon={<QrCode size={18} />} label="Assets" />
            <NavItem icon={<Mail size={18} />} label="Comms" />
          </nav>
        </div>

        <div className="mt-auto p-6 border-top border-slate-100">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="flex-1">
              <div className="text-sm font-medium">John Doe</div>
              <div className="text-xs text-slate-500">Admin Account</div>
            </div>
            <LogOut size={16} className="text-slate-400 group-hover:text-red-500 transition-colors" />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md sticky top-0 border-bottom border-slate-200 px-6 flex items-center justify-between z-40">
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>System</span>
            <ChevronRight size={14} />
            <span className="text-slate-900 font-medium">Dashboard Overview</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:text-slate-900 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-2 text-slate-500 hover:text-slate-900 transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        <section className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
          {/* Hero Section */}
          <header>
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2">Welcome back, John</h1>
            <p className="text-slate-500">Here's what's happening with your suite services today.</p>
          </header>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              label="System Health" 
              value={loading ? undefined : health?.status === 'ok' ? 'Online' : 'Offline'} 
              trend={loading ? undefined : health?.status === 'ok' ? 'All systems nominal' : 'Service interruption'}
              color={loading ? 'slate' : health?.status === 'ok' ? 'emerald' : 'rose'}
              loading={loading}
              icon={<Activity size={20} />}
            />
            <StatCard label="Live Receipts" value={receipts.length.toString()} trend="Total transactions synced" color="indigo" icon={<Database size={20} />} />
            <StatCard label="PDFs Generated" value="156" trend="+5 new requests" color="sky" icon={<FileText size={20} />} />
            <StatCard label="Mail Sent" value="890" trend="99.2% delivery rate" color="amber" icon={<Mail size={20} />} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Feature Access */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Capabilities Installed</h2>
                <div className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider rounded-lg">
                  Full Stack Active
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FeatureCard 
                  icon={<ShieldCheck className="text-indigo-600" />}
                  title="Secure Auth"
                  desc="JSON Web Tokens & Bcrypt hashing integration active."
                />
                <FeatureCard 
                  icon={<FileText className="text-sky-600" />}
                  title="PDF Generator"
                  desc="Dynamic document rendering with PDFKit library."
                />
                <FeatureCard 
                  icon={<QrCode className="text-emerald-600" />}
                  title="Inventory QR"
                  desc="Real-time QR code generation for asset tracking."
                />
                <FeatureCard 
                  icon={<Mail className="text-amber-600" />}
                  title="Automated Mail"
                  desc="Nodemailer configured with EJS template support."
                  onClick={() => {
                    const recipient = prompt('Enter recipient email:');
                    const subject = prompt('Enter subject:');
                    const body = prompt('Enter message body:');
                    if (recipient && subject && body) {
                      fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recipient, subject, body })
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) alert(`Sent! Message ID: ${data.messageId}`);
                        else alert(`Error: ${data.error}`);
                      });
                    }
                  }}
                />
                <FeatureCard 
                  icon={<ShieldCheck className="text-pink-600" />}
                  title="Termii SMS"
                  desc="Enterprise SMS gateway via Termii integration active."
                  onClick={() => {
                    const to = prompt('Enter recipient phone number:');
                    const message = prompt('Enter message:');
                    if (to && message) {
                      fetch('/api/send-sms', {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                          'Authorization': 'Bearer demo-token'
                        },
                        body: JSON.stringify({ to, message })
                      })
                      .then(res => res.json())
                      .then(data => {
                        if (data.success) alert(`Sent! Message ID: ${data.messageId}`);
                        else alert(`Error: ${data.error}`);
                      });
                    }
                  }}
                />
              </div>
            </div>

            {/* Recent Transactions List */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-bold">Recent Transactions</h2>
                
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative group flex-1 sm:max-w-xs sm:w-[300px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search name, ref, or amount..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  <div className="relative group">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 pointer-events-none" size={16} />
                    <select 
                      value={bankFilter}
                      onChange={(e) => setBankFilter(e.target.value)}
                      className="appearance-none bg-white border border-slate-200 rounded-2xl py-2.5 pl-10 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer min-w-[140px]"
                    >
                      <option value="">All Banks</option>
                      {banks.map(bank => (
                        <option key={bank.code} value={bank.name}>{bank.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-6 py-4 w-10">
                          <button 
                            onClick={toggleSelectAll}
                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                          >
                            {selectedIds.length === receipts.length && receipts.length > 0 ? (
                              <CheckSquare size={18} className="text-indigo-600" />
                            ) : (
                              <Square size={18} />
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {fetchingReceipts ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            <td className="px-6 py-4">
                              <Skeleton className="h-4 w-4" />
                            </td>
                            <td className="px-6 py-4">
                              <Skeleton className="h-4 w-32 mb-2" />
                              <Skeleton className="h-3 w-20" />
                            </td>
                            <td className="px-6 py-4">
                              <Skeleton className="h-4 w-16" />
                            </td>
                            <td className="px-6 py-4">
                              <Skeleton className="h-6 w-16 rounded-lg" />
                            </td>
                            <td className="px-6 py-4">
                              <Skeleton className="h-4 w-40" />
                            </td>
                          </tr>
                        ))
                      ) : receipts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm italic">
                            No receipts found matching your criteria.
                          </td>
                        </tr>
                      ) : (
                        receipts.map((tx) => (
                          <tr 
                            key={tx._id} 
                            className={`hover:bg-slate-50/50 transition-colors group cursor-pointer ${selectedIds.includes(tx._id) ? 'bg-indigo-50/30' : ''}`}
                          >
                            <td className="px-6 py-4" onClick={(e) => { e.stopPropagation(); toggleSelect(tx._id); }}>
                              <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                                {selectedIds.includes(tx._id) ? (
                                  <CheckSquare size={18} className="text-indigo-600" />
                                ) : (
                                  <Square size={18} />
                                )}
                              </button>
                            </td>
                            <td className="px-6 py-4 text-left" onClick={() => window.location.href = `/receipt/${tx._id}`}>
                              <div className="font-semibold text-slate-900">{tx.name}</div>
                              <div className="text-[10px] text-slate-400 mono">{tx.ref}</div>
                            </td>
                            <td className="px-6 py-4 font-mono text-sm font-bold text-indigo-600">{tx.amount}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${tx.status === 'Successful' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 max-w-[200px] truncate" title={tx.notes}>
                              {tx.notes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bulk Actions Bar */}
              <AnimatePresence>
                {selectedIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-3xl shadow-2xl flex items-center gap-8 z-[60] border border-slate-800 backdrop-blur-xl"
                  >
                    <div className="flex items-center gap-3 pr-8 border-r border-slate-700">
                      <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm">
                        {selectedIds.length}
                      </div>
                      <span className="text-sm font-medium text-slate-300 select-none">Items Selected</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleBulkExport}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-slate-800 rounded-xl transition-colors text-sm font-semibold group"
                      >
                        <Download size={18} className="text-slate-400 group-hover:text-sky-400 transition-colors" />
                        <span>Export CSV</span>
                      </button>

                      <button 
                        onClick={handleBulkDelete}
                        disabled={isBulkDeleting}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all text-sm font-semibold group disabled:opacity-50"
                      >
                        {isBulkDeleting ? (
                          <Loader2 size={18} className="animate-spin" />
                        ) : (
                          <Trash2 size={18} className="text-slate-400 group-hover:text-red-500 transition-colors" />
                        )}
                        <span>Delete Selected</span>
                      </button>

                      <div className="h-4 w-[1px] bg-slate-700 mx-2" />

                      <button 
                        onClick={() => setSelectedIds([])}
                        className="text-sm font-bold text-slate-500 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* System Status Panel */}
            <aside className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Live Status</h2>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  title="Quick Create Receipt"
                >
                  <Database size={16} />
                </button>
              </div>
              <div className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-medium">Uptime</span>
                    <span className="text-slate-900 font-bold">99.98%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '99.98%' }}
                      transition={{ duration: 1.5, ease: "circOut" }}
                      className="h-full bg-emerald-500" 
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-4 border-top border-slate-100">
                  <StatusLine label="API Server" status="active" />
                  <StatusLine label="Database Cluster" status="active" />
                  <StatusLine label="Worker Pool" status="warning" />
                  <StatusLine label="Mailer Relay" status="active" />
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Server Check-in</div>
                  <div className="text-xs font-mono text-slate-600 break-all">
                    {loading ? 'Initializing...' : health?.timestamp || 'Waiting...'}
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showCreateModal && <CreateReceiptModal onClose={() => setShowCreateModal(false)} onCreated={fetchReceipts} />}
      </AnimatePresence>

      <AnimatePresence>
        {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      </AnimatePresence>
    </div>
  );
}

function CreateReceiptModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [banks, setBanks] = useState<{ name: string; code: string }[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    accountNumber: '',
    bankCode: '',
    name: '',
    email: '',
    phone: '',
    notes: ''
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setLoadingBanks(true);
    fetch('/api/banks')
      .then(res => res.json())
      .then(data => {
        setBanks(data);
        setLoadingBanks(false);
      });
  }, []);

  useEffect(() => {
    if (formData.accountNumber.length === 10 && formData.bankCode) {
      resolveAccount();
    }
  }, [formData.accountNumber, formData.bankCode]);

  const resolveAccount = async () => {
    setResolving(true);
    try {
      const res = await fetch('/api/banks/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountNumber: formData.accountNumber, 
          bankCode: formData.bankCode 
        })
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({ ...prev, name: data.accountName }));
      }
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    const bank = banks.find(b => b.code === formData.bankCode);
    const payload = {
      ...formData,
      bankName: bank?.name || '',
      ref: 'TXN' + Math.random().toString().slice(2, 8),
      channel: 'Transfer',
      status: 'Successful'
    };

    // Client-side validation
    const validation = ReceiptSchema.safeParse(payload);
    if (!validation.success) {
      setErrors(validation.error.flatten().fieldErrors);
      setIsSubmitting(false);
      return;
    }
    
    try {
      const res = await fetch('/api/receipts/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.link);
        onCreated();
      } else {
        setErrors(data.details || { general: [data.error || 'Submission failed'] });
      }
    } catch (err) {
      setErrors({ general: ['Network error. Please try again.'] });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Create Receipt</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {success ? (
            <div className="text-center py-10 space-y-6">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={40} />
              </div>
              <div>
                <h3 className="text-xl font-bold">Receipt Created!</h3>
                <p className="text-slate-500 text-sm mt-1">Notification sent to customer successfully.</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-2xl break-all font-mono text-xs text-indigo-600">
                {success}
              </div>
              <button 
                onClick={onClose}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-colors"
              >
                Close Dashboard
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Bank</label>
                <select 
                  className={`w-full bg-slate-50 border ${errors.bankName ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                  value={formData.bankCode}
                  onChange={e => setFormData(p => ({ ...p, bankCode: e.target.value }))}
                >
                  <option value="">Select Receiver's Bank</option>
                  {banks.map(b => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
                {errors.bankName && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">{errors.bankName[0]}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Number</label>
                  <input 
                    type="text" 
                    placeholder="0123456789"
                    className={`w-full bg-slate-50 border ${errors.accountNumber ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                    value={formData.accountNumber}
                    onChange={e => setFormData(p => ({ ...p, accountNumber: e.target.value }))}
                    maxLength={10}
                  />
                  {errors.accountNumber && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">{errors.accountNumber[0]}</p>}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount</label>
                  <input 
                    type="text" 
                    placeholder="₦ 5,000.00"
                    className={`w-full bg-slate-50 border ${errors.amount ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                    value={formData.amount}
                    onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))}
                  />
                  {errors.amount && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">{errors.amount[0]}</p>}
                </div>
              </div>

              <div className="relative">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Beneficiary Name</label>
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Automatic background search..."
                    className={`w-full bg-slate-50 border ${errors.name ? 'border-red-200 ring-2 ring-red-500/10' : 'border-slate-100'} rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${resolving ? 'pr-12' : ''}`}
                    value={formData.name}
                    onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  />
                  {errors.name && <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 uppercase">{errors.name[0]}</p>}
                  {resolving && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 size={20} className="animate-spin text-indigo-600" />
                    </div>
                  )}
                </div>
                {formData.name && !resolving && formData.accountNumber.length === 10 && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="absolute -bottom-6 left-1 text-[9px] font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle size={10} /> Account Validated
                  </motion.div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Email (Optional)</label>
                  <input 
                    type="email" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={formData.email}
                    onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Phone (SMS Alert)</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={formData.phone}
                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>

              {errors.general && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-xs text-red-600 font-medium">
                  {errors.general[0]}
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting || resolving}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <span>Generate & Send Receipt</span>
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function NavItem({ icon, label, active = false }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <div className={`
      flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 font-medium
      ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
    `}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-slate-200 rounded-md overflow-hidden relative ${className}`}>
      <div className="absolute inset-0 animate-shimmer" />
    </div>
  );
}

function StatCard({ label, value, trend, color, loading = false, icon }: { label: string; value?: string; trend?: string; color: string; loading?: boolean; icon?: React.ReactNode }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    sky: 'bg-sky-50 text-sky-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-400',
  };

  return (
    <motion.div 
      whileHover={loading ? {} : { y: -4 }}
      className="p-6 bg-white border border-slate-200 rounded-3xl shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50"
    >
      <div className={`w-10 h-10 ${colors[color]} rounded-xl flex items-center justify-center mb-4`}>
        {loading ? <Activity size={20} className="animate-spin" /> : icon}
      </div>
      <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
      <div className="text-2xl font-bold mb-1 tracking-tight">
        {loading ? <Skeleton className="h-8 w-24" /> : value}
      </div>
      <div className="text-xs text-slate-500">
        {loading ? <Skeleton className="h-3 w-32 mt-2" /> : trend}
      </div>
    </motion.div>
  );
}

function FeatureCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`p-6 bg-white border border-slate-200 rounded-3xl hover:border-indigo-200 transition-colors group ${onClick ? 'cursor-pointer active:scale-95' : ''}`}
    >
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function StatusLine({ label, status }: { label: string; status: 'active' | 'warning' | 'error' }) {
  const statusColors = {
    active: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-rose-500',
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-400 capitalize">{status}</span>
        <div className={`w-2 h-2 ${statusColors[status]} rounded-full`} />
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    termiiApiKey: '',
    termiiSenderId: '',
    emailUser: '',
    emailPass: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setSettings({
          termiiApiKey: data.termiiApiKey || '',
          termiiSenderId: data.termiiSenderId || '',
          emailUser: data.emailUser || '',
          emailPass: data.emailPass || ''
        });
        setLoading(false);
      })
      .catch(err => {
        console.error('Settings fetch error:', err);
        setLoading(false);
      });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings updated successfully' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 lg:p-12 overflow-y-auto"
    >
      <motion.div 
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative my-auto"
      >
        <button 
          onClick={onClose}
          className="absolute right-8 top-8 p-2 hover:bg-slate-50 rounded-xl transition-colors z-10"
        >
          <X size={20} className="text-slate-400" />
        </button>

        <div className="p-8 lg:p-12">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
              <p className="text-slate-500 text-sm">Manage your API integrations and alert preferences</p>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
              <p className="text-slate-400 text-sm font-medium">Synchronizing configurations...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-8">
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">SMS Gateway (Termii)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">API Key</label>
                      <input 
                        type="password" 
                        value={settings.termiiApiKey}
                        onChange={e => setSettings(p => ({ ...p, termiiApiKey: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="Your Termii API Key"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Sender ID</label>
                      <input 
                        type="text" 
                        value={settings.termiiSenderId}
                        onChange={e => setSettings(p => ({ ...p, termiiSenderId: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="e.g. ApexSuite"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Email Service (Gmail)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Gmail Address</label>
                      <input 
                        type="email" 
                        value={settings.emailUser}
                        onChange={e => setSettings(p => ({ ...p, emailUser: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="your-email@gmail.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">App Password</label>
                      <input 
                        type="password" 
                        value={settings.emailPass}
                        onChange={e => setSettings(p => ({ ...p, emailPass: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="••••••••••••••••"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-3 ml-1 italic">* Use a Google App Password for secure authenticated access</p>
                </div>
              </div>

              {message && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl text-xs font-bold uppercase tracking-wider text-center ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}
                >
                  {message.text}
                </motion.div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-8 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-[2] bg-indigo-600 text-white rounded-2xl py-4 font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      <span>Save Configurations</span>
                      <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
