import React, { useState } from 'react';
import { Plus, Check, Clock, AlertTriangle, Shield, Filter } from 'lucide-react';
import { PaymentRecord, Member } from '../../types/index.ts';

interface PaymentsScreenProps {
  payments: PaymentRecord[];
  members?: Member[];
  collectedMtd: number;
  pendingDues: number;
  overdueCount: number;
  onRecordPayment: () => void;
  onUpdateStatus: (id: number, status: 'Paid' | 'Overdue' | 'Pending') => void;
}

export const PaymentsScreen: React.FC<PaymentsScreenProps> = ({
  payments,
  members = [],
  collectedMtd,
  pendingDues,
  overdueCount,
  onRecordPayment,
  onUpdateStatus,
}) => {
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');

  // Helper map for member lookup by ID or code
  const memberMap = new Map<string, Member>();
  members.forEach((m) => {
    if (m.member_id) memberMap.set(m.member_id.toUpperCase(), m);
  });

  const getPlanTier = (item: PaymentRecord): string => {
    // 1. Check member registry first
    const member = memberMap.get(item.member_id.toUpperCase());
    if (member?.plan_type) return member.plan_type;

    // 2. Extract from plan_description
    const desc = (item.plan_description || '').toLowerCase();
    if (desc.includes('platinum')) return 'Platinum';
    if (desc.includes('gold')) return 'Gold';
    if (desc.includes('silver')) return 'Silver';
    return 'Standard';
  };

  const getBillingCycle = (desc?: string): string => {
    const text = (desc || '').toLowerCase();
    if (text.includes('annual') || text.includes('12 month') || text.includes('yearly')) return 'Annual (12M)';
    if (text.includes('6 month') || text.includes('half-year')) return '6-Month Access';
    if (text.includes('quarter')) return 'Quarterly (3M)';
    if (text.includes('monthly') || text.includes('1 month')) return 'Monthly Access';
    return 'Standard Cycle';
  };

  const getPlanBadge = (plan: string) => {
    switch (plan.toLowerCase()) {
      case 'platinum':
        return 'bg-[#C9FF3D]/15 text-[#C9FF3D] border border-[#C9FF3D]/30';
      case 'gold':
        return 'bg-amber-400/15 text-amber-300 border border-amber-400/30';
      case 'silver':
        return 'bg-[#9A9E9F]/15 text-[#EDEEEA] border border-[#9A9E9F]/30';
      default:
        return 'bg-[#212528] text-[#9A9E9F] border border-[#2C3034]';
    }
  };

  const filtered = payments.filter((p) => {
    const matchesStatus = statusFilter === 'All' || p.payment_status === statusFilter;
    const tier = getPlanTier(p);
    const matchesPlan = planFilter === 'All' || tier.toLowerCase() === planFilter.toLowerCase();
    return matchesStatus && matchesPlan;
  });

  const getInitials = (name?: string) => {
    if (!name) return 'MB';
    return name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const getDueStatusMeta = (dueDate: string, status: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const due = new Date(dueDate);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (status === 'Paid') {
        return { text: 'Settled', color: 'text-[#8FB82A]' };
      }
      if (diffDays < 0) {
        return { text: `${Math.abs(diffDays)}d overdue`, color: 'text-[#FF5F45]' };
      }
      if (diffDays === 0) {
        return { text: 'Due today', color: 'text-[#FF5F45]' };
      }
      return { text: `Due in ${diffDays}d`, color: 'text-[#9A9E9F]' };
    } catch {
      return { text: '', color: '' };
    }
  };

  // Plan revenue breakdown calculations
  const planRevenue = {
    Silver: payments.filter((p) => getPlanTier(p) === 'Silver' && p.payment_status === 'Paid').reduce((acc, p) => acc + p.amount, 0),
    Gold: payments.filter((p) => getPlanTier(p) === 'Gold' && p.payment_status === 'Paid').reduce((acc, p) => acc + p.amount, 0),
    Platinum: payments.filter((p) => getPlanTier(p) === 'Platinum' && p.payment_status === 'Paid').reduce((acc, p) => acc + p.amount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-anton text-3xl tracking-wide text-[#EDEEEA]">Payments & Plans</h1>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#C9FF3D]/15 text-[#C9FF3D] border border-[#C9FF3D]/30 uppercase">
              Billing Ledger
            </span>
          </div>
          <p className="text-xs text-[#9A9E9F] mt-1">
            Tracking membership plan billing, fee cycles, and invoice collections across all tiers.
          </p>
        </div>
        <button
          onClick={onRecordPayment}
          className="bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] font-bold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Record Payment</span>
        </button>
      </div>

      {/* Stat Grid (3 columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-4.5">
          <div className="text-[11px] uppercase tracking-wider text-[#5D6164] mb-2 font-medium">
            Collected (MTD)
          </div>
          <div className="font-mono text-2xl font-semibold text-[#EDEEEA]">
            {formatCurrency(collectedMtd)}
          </div>
          <div className="text-xs mt-1.5 text-[#8FB82A]">From paid membership fees</div>
        </div>

        <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-4.5">
          <div className="text-[11px] uppercase tracking-wider text-[#5D6164] mb-2 font-medium">
            Pending Dues
          </div>
          <div className="font-mono text-2xl font-semibold text-[#EDEEEA]">
            {formatCurrency(pendingDues)}
          </div>
          <div className="text-xs mt-1.5 text-[#FF5F45]">Awaiting collection</div>
        </div>

        <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-4.5">
          <div className="text-[11px] uppercase tracking-wider text-[#5D6164] mb-2 font-medium">
            Overdue Invoices
          </div>
          <div className="font-mono text-2xl font-semibold text-[#EDEEEA]">{overdueCount}</div>
          <div className="text-xs mt-1.5 text-[#9A9E9F]">Requires follow-up</div>
        </div>
      </div>

      {/* Plan Revenue Breakdown Bar */}
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-[#9A9E9F]">
          <Shield className="w-4 h-4 text-[#C9FF3D]" />
          <span className="font-semibold text-[#EDEEEA]">Collections by Plan Tier:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#9A9E9F]/15 text-[#EDEEEA] border border-[#9A9E9F]/30">
              Silver
            </span>
            <span className="font-mono font-medium text-[#EDEEEA]">{formatCurrency(planRevenue.Silver)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30">
              Gold
            </span>
            <span className="font-mono font-medium text-[#EDEEEA]">{formatCurrency(planRevenue.Gold)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#C9FF3D]/15 text-[#C9FF3D] border border-[#C9FF3D]/30">
              Platinum
            </span>
            <span className="font-mono font-medium text-[#EDEEEA]">{formatCurrency(planRevenue.Platinum)}</span>
          </div>
        </div>
      </div>

      {/* Filters (Status + Plan Tier) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1A1D21] border border-[#2C3034] p-2.5 rounded-xl">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1">
          {['All', 'Paid', 'Pending', 'Overdue'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                statusFilter === tab
                  ? 'bg-[#212528] text-[#C9FF3D] border border-[#2C3034]'
                  : 'text-[#9A9E9F] hover:text-[#EDEEEA] hover:bg-[#212528]/50'
              }`}
            >
              {tab} ({tab === 'All' ? payments.length : payments.filter((p) => p.payment_status === tab).length})
            </button>
          ))}
        </div>

        {/* Plan Tier Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[#5D6164]" />
          <span className="text-[11px] text-[#5D6164] uppercase font-mono">Plan:</span>
          {['All', 'Silver', 'Gold', 'Platinum'].map((p) => (
            <button
              key={p}
              onClick={() => setPlanFilter(p)}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                planFilter === p
                  ? 'bg-[#C9FF3D]/20 text-[#C9FF3D] border border-[#C9FF3D]/40'
                  : 'text-[#9A9E9F] hover:text-[#EDEEEA] bg-[#212528]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-4 sm:p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#2C3034]">
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider">
                  Member
                </th>
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider">
                  Registered Plan Tier
                </th>
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider">
                  Billing Cycle & Description
                </th>
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider">
                  Amount
                </th>
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider">
                  Due Date
                </th>
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider">
                  Status
                </th>
                <th className="pb-3 px-3 text-[11px] font-medium text-[#5D6164] uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-[#9A9E9F]">
                    No payment records found under this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const member = memberMap.get(item.member_id.toUpperCase());
                  const memberName = item.member_name || member?.full_name || 'Member';
                  const planTier = getPlanTier(item);
                  const cycleDesc = getBillingCycle(item.plan_description);

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[#2C3034] last:border-b-0 hover:bg-[#212528]/40 transition-colors"
                    >
                      {/* Member Info (Name + ID + Avatar) */}
                      <td className="py-3 px-3 text-[#EDEEEA]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#212528] border border-[#2C3034] flex items-center justify-center text-xs font-bold text-[#C9FF3D] shrink-0">
                            {getInitials(memberName)}
                          </div>
                          <div>
                            <span className="font-medium text-[#EDEEEA] block">{memberName}</span>
                            <span className="block text-[11px] text-[#5D6164] font-mono">
                              {item.member_id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Official Plan Badge matching MembersScreen */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${getPlanBadge(
                            planTier
                          )}`}
                        >
                          {planTier}
                        </span>
                        {member?.trainer_name && member.trainer_name !== 'Unassigned' && (
                          <span className="block text-[10px] text-[#5D6164] mt-0.5 font-mono">
                            Coach: {member.trainer_name}
                          </span>
                        )}
                      </td>

                      {/* Billing Cycle / Description */}
                      <td className="py-3 px-3 text-[#EDEEEA]">
                        <span className="font-medium block">{cycleDesc}</span>
                        <span className="text-[11px] text-[#5D6164] font-mono">
                          {item.plan_description}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3 font-mono font-semibold text-[#EDEEEA]">
                        {formatCurrency(item.amount)}
                      </td>

                      {/* Due Date & Meta */}
                      <td className="py-3 px-3 font-mono text-xs text-[#9A9E9F]">
                        <div>{item.due_date}</div>
                        {(() => {
                          const meta = getDueStatusMeta(item.due_date, item.payment_status);
                          return meta.text ? (
                            <div className={`text-[10px] ${meta.color} font-sans font-medium mt-0.5`}>
                              {meta.text}
                            </div>
                          ) : null;
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.payment_status === 'Paid'
                              ? 'bg-[#C9FF3D]/15 text-[#C9FF3D]'
                              : item.payment_status === 'Overdue'
                              ? 'bg-[#FF5F45]/15 text-[#FF5F45]'
                              : 'bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          {item.payment_status}
                        </span>
                      </td>

                      {/* Change Status Action */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.payment_status !== 'Paid' && (
                            <button
                              onClick={() => onUpdateStatus(item.id, 'Paid')}
                              title="Mark as Paid"
                              className="px-2.5 py-1 text-xs rounded bg-[#212528] hover:bg-[#C9FF3D]/20 text-[#C9FF3D] border border-[#2C3034] transition-colors cursor-pointer font-medium"
                            >
                              Mark Paid
                            </button>
                          )}
                          {item.payment_status === 'Paid' && (
                            <span className="text-[11px] text-[#8FB82A] font-medium flex items-center justify-end gap-1">
                              <Check className="w-3.5 h-3.5" />
                              <span>Settled</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
