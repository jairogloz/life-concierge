import { useEffect, useState, useCallback } from 'react';
import { useApi } from '../lib/useApi';
import Spinner from '../components/Spinner';
import type { Account, Transaction, FinanceSummary, AccountType, TransactionType } from '../types';

// ── helpers ───────────────────────────────────────────────────────────────────

const fmt = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);

const today = () => new Date().toISOString().split('T')[0];

// ── sub-types ─────────────────────────────────────────────────────────────────

interface SplitRow { category: string; amount: string; percentage: string; }

const EMPTY_ACCOUNT = { name: '', type: 'checking' as AccountType, currency: 'USD', balance: '' };
const EMPTY_TX = {
  account_id: '', type: 'expense' as TransactionType, amount: '', currency: 'USD',
  category: '', description: '', date: today(), splits: [] as SplitRow[],
};

// ── component ─────────────────────────────────────────────────────────────────

export default function Finance() {
  const api = useApi();
  const [tab, setTab] = useState<'accounts' | 'transactions' | 'transfer'>('accounts');
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);

  // forms
  const [accForm, setAccForm] = useState(EMPTY_ACCOUNT);
  const [txForm, setTxForm] = useState(EMPTY_TX);
  const [trForm, setTrForm] = useState({ from_account_id: '', to_account_id: '', amount: '', currency: 'USD', description: '', date: today() });

  const [saving, setSaving] = useState(false);
  const [splitEnabled, setSplitEnabled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, txRes, sumRes] = await Promise.all([
        api.get<{ data: Account[] }>('/accounts'),
        api.get<{ data: Transaction[] }>('/transactions'),
        api.get<FinanceSummary>('/finance/summary'),
      ]);
      setAccounts(accRes.data.data ?? []);
      setTransactions(txRes.data.data ?? []);
      setSummary(sumRes.data);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  // ── account create ────────────────────────────────────────────────────────

  async function createAccount() {
    setSaving(true);
    try {
      await api.post('/accounts', { ...accForm, balance: parseFloat(accForm.balance as string) || 0 });
      setAccForm(EMPTY_ACCOUNT);
      await load();
    } finally { setSaving(false); }
  }

  // ── transaction create ────────────────────────────────────────────────────

  function addSplitRow() {
    setTxForm(p => ({ ...p, splits: [...p.splits, { category: '', amount: '', percentage: '' }] }));
  }

  function updateSplit(i: number, field: keyof SplitRow, value: string) {
    setTxForm(p => {
      const splits = p.splits.map((s, idx) => idx === i ? { ...s, [field]: value } : s);
      return { ...p, splits };
    });
  }

  function removeSplit(i: number) {
    setTxForm(p => ({ ...p, splits: p.splits.filter((_, idx) => idx !== i) }));
  }

  async function createTransaction() {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        ...txForm,
        amount: parseFloat(txForm.amount as string),
      };
      if (splitEnabled && txForm.splits.length > 0) {
        payload.splits = txForm.splits.map(s => ({
          category: s.category,
          amount: parseFloat(s.amount),
          percentage: parseFloat(s.percentage),
        }));
      } else {
        delete payload.splits;
      }
      await api.post('/transactions', payload);
      setTxForm(EMPTY_TX);
      setSplitEnabled(false);
      await load();
    } finally { setSaving(false); }
  }

  // ── transfer create ───────────────────────────────────────────────────────

  async function createTransfer() {
    setSaving(true);
    try {
      await api.post('/transfers', { ...trForm, amount: parseFloat(trForm.amount as string) });
      setTrForm({ from_account_id: '', to_account_id: '', amount: '', currency: 'USD', description: '', date: today() });
      await load();
    } finally { setSaving(false); }
  }

  // ── render ────────────────────────────────────────────────────────────────

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const btnPrimary = 'px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors';
  const btnGhost = 'px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Finance</h1>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Balance', value: fmt(summary.total_balance), color: 'indigo' },
            { label: 'Month Income', value: fmt(summary.month_income), color: 'green' },
            { label: 'Month Expenses', value: fmt(summary.month_expenses), color: 'red' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['accounts', 'transactions', 'transfer'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {t === 'transfer' ? 'Transfer' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── Accounts tab ────────────────────────────────────────────── */}
          {tab === 'accounts' && (
            <div>
              {/* Create form */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">New Account</h2>
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputCls} placeholder="Name (e.g. Chase Checking)"
                    value={accForm.name} onChange={e => setAccForm(p => ({ ...p, name: e.target.value }))} />
                  <select className={inputCls} value={accForm.type}
                    onChange={e => setAccForm(p => ({ ...p, type: e.target.value as AccountType }))}>
                    {['checking', 'savings', 'cash', 'investment', 'credit_card', 'other'].map(t => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                  <input className={inputCls} placeholder="Currency (USD)" maxLength={3}
                    value={accForm.currency} onChange={e => setAccForm(p => ({ ...p, currency: e.target.value.toUpperCase() }))} />
                  <input className={inputCls} type="number" placeholder="Opening balance (0)"
                    value={accForm.balance} onChange={e => setAccForm(p => ({ ...p, balance: e.target.value }))} />
                </div>
                <button className={`mt-3 ${btnPrimary}`} disabled={saving || !accForm.name} onClick={createAccount}>
                  {saving ? 'Saving…' : 'Create Account'}
                </button>
              </div>

              {/* List */}
              <ul className="space-y-3">
                {accounts.map(acc => (
                  <li key={acc.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
                    <div>
                      <p className="font-medium text-gray-900">{acc.name}</p>
                      <p className="text-xs text-gray-400">{acc.type.replace('_', ' ')} · {acc.currency}</p>
                    </div>
                    <p className={`text-lg font-bold ${acc.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {fmt(acc.balance, acc.currency)}
                    </p>
                  </li>
                ))}
                {accounts.length === 0 && <p className="text-center text-gray-400 py-12">No accounts yet.</p>}
              </ul>
            </div>
          )}

          {/* ── Transactions tab ─────────────────────────────────────────── */}
          {tab === 'transactions' && (
            <div>
              {/* Create form */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Log Transaction</h2>
                <div className="grid grid-cols-2 gap-3">
                  <select className={inputCls} value={txForm.account_id}
                    onChange={e => setTxForm(p => ({ ...p, account_id: e.target.value }))}>
                    <option value="">Select account…</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <select className={inputCls} value={txForm.type}
                    onChange={e => setTxForm(p => ({ ...p, type: e.target.value as TransactionType }))}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                  <input className={inputCls} type="number" min="0.01" step="0.01" placeholder="Amount"
                    value={txForm.amount} onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))} />
                  <input className={inputCls} placeholder="Category (e.g. Groceries)"
                    value={txForm.category} onChange={e => setTxForm(p => ({ ...p, category: e.target.value }))} />
                  <input className={inputCls} placeholder="Description (optional)"
                    value={txForm.description} onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))} />
                  <input className={inputCls} type="date" value={txForm.date}
                    onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))} />
                </div>

                {/* Splits */}
                <div className="mt-3">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox" checked={splitEnabled}
                      onChange={e => { setSplitEnabled(e.target.checked); if (!e.target.checked) setTxForm(p => ({ ...p, splits: [] })); }} />
                    Split across categories
                  </label>
                  {splitEnabled && (
                    <div className="mt-2 space-y-2">
                      {txForm.splits.map((s, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs" placeholder="Category"
                            value={s.category} onChange={e => updateSplit(i, 'category', e.target.value)} />
                          <input className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs" type="number" placeholder="Amount"
                            value={s.amount} onChange={e => updateSplit(i, 'amount', e.target.value)} />
                          <input className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs" type="number" placeholder="%"
                            value={s.percentage} onChange={e => updateSplit(i, 'percentage', e.target.value)} />
                          <button onClick={() => removeSplit(i)} className="text-red-500 hover:text-red-700 text-xs">✕</button>
                        </div>
                      ))}
                      <button onClick={addSplitRow} className="text-xs text-indigo-600 hover:text-indigo-800">+ Add split</button>
                    </div>
                  )}
                </div>

                <button className={`mt-3 ${btnPrimary}`}
                  disabled={saving || !txForm.account_id || !txForm.amount} onClick={createTransaction}>
                  {saving ? 'Saving…' : 'Log Transaction'}
                </button>
              </div>

              {/* List */}
              <ul className="space-y-2">
                {transactions.map(tx => (
                  <li key={tx.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                        {tx.type === 'income' ? '↑' : '↓'}
                      </span>
                      <div>
                        <p className="font-medium text-gray-900">{tx.category || '—'}</p>
                        <p className="text-xs text-gray-400">{tx.description || 'No description'} · {tx.date?.split('T')[0]}</p>
                        {tx.splits && tx.splits.length > 0 && (
                          <p className="text-xs text-indigo-500">{tx.splits.length} split{tx.splits.length > 1 ? 's' : ''}</p>
                        )}
                      </div>
                    </div>
                    <p className={`font-bold ${tx.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                      {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount, tx.currency)}
                    </p>
                  </li>
                ))}
                {transactions.length === 0 && <p className="text-center text-gray-400 py-12">No transactions yet.</p>}
              </ul>
            </div>
          )}

          {/* ── Transfer tab ─────────────────────────────────────────────── */}
          {tab === 'transfer' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Transfer Between Accounts</h2>
              <div className="grid grid-cols-2 gap-3">
                <select className={inputCls} value={trForm.from_account_id}
                  onChange={e => setTrForm(p => ({ ...p, from_account_id: e.target.value }))}>
                  <option value="">From account…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance, a.currency)})</option>)}
                </select>
                <select className={inputCls} value={trForm.to_account_id}
                  onChange={e => setTrForm(p => ({ ...p, to_account_id: e.target.value }))}>
                  <option value="">To account…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({fmt(a.balance, a.currency)})</option>)}
                </select>
                <input className={inputCls} type="number" min="0.01" step="0.01" placeholder="Amount"
                  value={trForm.amount} onChange={e => setTrForm(p => ({ ...p, amount: e.target.value }))} />
                <input className={inputCls} type="date" value={trForm.date}
                  onChange={e => setTrForm(p => ({ ...p, date: e.target.value }))} />
                <input className={`${inputCls} col-span-2`} placeholder="Description (optional)"
                  value={trForm.description} onChange={e => setTrForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="flex gap-2 mt-4">
                <button className={btnPrimary}
                  disabled={saving || !trForm.from_account_id || !trForm.to_account_id || !trForm.amount}
                  onClick={createTransfer}>
                  {saving ? 'Transferring…' : 'Transfer'}
                </button>
                <button className={btnGhost} onClick={() => setTrForm({ from_account_id: '', to_account_id: '', amount: '', currency: 'USD', description: '', date: today() })}>
                  Reset
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
