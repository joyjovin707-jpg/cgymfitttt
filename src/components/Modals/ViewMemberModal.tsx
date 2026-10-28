import React from 'react';
import { X, User, Award, Calendar, Clock, Edit2, ShieldCheck, Dumbbell, Star, AlertCircle, Phone, Mail } from 'lucide-react';
import { Member, Trainer } from '../../types/index.ts';

interface ViewMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member | null;
  trainers: Trainer[];
  onEdit: (member: Member) => void;
}

export const ViewMemberModal: React.FC<ViewMemberModalProps> = ({
  isOpen,
  onClose,
  member,
  trainers,
  onEdit,
}) => {
  if (!isOpen || !member) return null;

  const assignedTrainer = trainers.find(
    (t) =>
      (member.trainer_id !== null && Number(t.id) === Number(member.trainer_id)) ||
      (member.trainer_name && member.trainer_name.toLowerCase() === t.full_name.toLowerCase())
  );

  const trainerName = assignedTrainer?.full_name || (member.trainer_name && member.trainer_name !== 'Unassigned' ? member.trainer_name : 'Unassigned');

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getDaysRemaining = (expiryDate: string) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const exp = new Date(expiryDate);
      exp.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return { text: `Expired ${Math.abs(diffDays)} days ago`, color: 'text-[#FF5F45]', bg: 'bg-[#FF5F45]/15 border-[#FF5F45]/30' };
      if (diffDays === 0) return { text: 'Expires Today', color: 'text-[#FF5F45]', bg: 'bg-[#FF5F45]/15 border-[#FF5F45]/30' };
      if (diffDays <= 7) return { text: `${diffDays} days remaining (Expiring soon)`, color: 'text-[#FF5F45]', bg: 'bg-[#FF5F45]/15 border-[#FF5F45]/30' };
      return { text: `${diffDays} days remaining`, color: 'text-[#C9FF3D]', bg: 'bg-[#C9FF3D]/10 border-[#C9FF3D]/30' };
    } catch {
      return { text: 'Active', color: 'text-[#C9FF3D]', bg: 'bg-[#C9FF3D]/10 border-[#C9FF3D]/30' };
    }
  };

  const validityMeta = getDaysRemaining(member.expiry_date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#1A1D21] border border-[#2C3034] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#2C3034] bg-[#212528]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#C9FF3D]/10 border border-[#C9FF3D]/30 flex items-center justify-center text-[#C9FF3D]">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#EDEEEA]">Member Profile Details</h2>
              <p className="text-[11px] text-[#9A9E9F]">C-FIT Encapsulated Member Record</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#9A9E9F] hover:text-[#EDEEEA] hover:bg-[#2C3034] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Identity Hero */}
          <div className="flex items-center gap-4 bg-[#212528] p-4 rounded-xl border border-[#2C3034]">
            <div className="w-14 h-14 rounded-full bg-[#1A1D21] border-2 border-[#C9FF3D] flex items-center justify-center text-lg font-anton text-[#C9FF3D] shrink-0">
              {getInitials(member.full_name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#EDEEEA] truncate capitalize">{member.full_name}</h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                    member.status === 'Active'
                      ? 'bg-[#C9FF3D]/20 text-[#C9FF3D] border border-[#C9FF3D]/40'
                      : member.status === 'Expiring'
                      ? 'bg-[#FF5F45]/20 text-[#FF5F45] border border-[#FF5F45]/40'
                      : 'bg-[#9A9E9F]/20 text-[#9A9E9F] border border-[#9A9E9F]/40'
                  }`}
                >
                  {member.status}
                </span>
              </div>
              <p className="text-xs font-mono text-[#9A9E9F] mt-0.5">{member.member_id}</p>
            </div>
          </div>

          {/* Assigned Trainer Section */}
          <div className="bg-[#212528]/80 border border-[#2C3034] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#9A9E9F] flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-[#C9FF3D]" />
                Assigned Personal Trainer
              </span>
              {assignedTrainer && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#C9FF3D]/10 text-[#C9FF3D] border border-[#C9FF3D]/20">
                  {assignedTrainer.trainer_code}
                </span>
              )}
            </div>

            {assignedTrainer ? (
              <div className="flex items-center justify-between bg-[#1A1D21] p-3 rounded-lg border border-[#2C3034]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#212528] border border-[#2C3034] flex items-center justify-center font-bold text-xs text-[#EDEEEA]">
                    {getInitials(assignedTrainer.full_name)}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#EDEEEA]">{assignedTrainer.full_name}</h4>
                    <p className="text-xs text-[#9A9E9F]">{assignedTrainer.specialty}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[#C9FF3D] bg-[#212528] px-2 py-1 rounded border border-[#2C3034] text-xs font-mono">
                  <Star className="w-3.5 h-3.5 fill-[#C9FF3D]" />
                  <span>{assignedTrainer.rating.toFixed(1)}</span>
                </div>
              </div>
            ) : trainerName !== 'Unassigned' ? (
              <div className="flex items-center justify-between bg-[#1A1D21] p-3 rounded-lg border border-[#2C3034]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#C9FF3D]" />
                  <span className="font-medium text-sm text-[#EDEEEA]">{trainerName}</span>
                </div>
                <span className="text-xs text-[#9A9E9F]">Personal Coach</span>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-[#1A1D21] p-3 rounded-lg border border-[#2C3034] text-xs text-[#5D6164]">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-[#5D6164]" />
                  <span>No dedicated trainer currently assigned to this member.</span>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onEdit(member);
                  }}
                  className="text-xs font-bold text-[#C9FF3D] hover:underline"
                >
                  Assign Coach
                </button>
              </div>
            )}
          </div>

          {/* Membership Tier & Validity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#212528]/80 border border-[#2C3034] p-3.5 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5D6164] flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-[#C9FF3D]" />
                Membership Plan
              </span>
              <p className="text-base font-bold text-[#EDEEEA]">{member.plan_type} Tier</p>
              <p className="text-[11px] text-[#9A9E9F]">
                {member.plan_type === 'Platinum' ? 'Full access + Unlimited classes' : member.plan_type === 'Gold' ? 'Gym floor + 3 classes/mo' : 'Standard gym access'}
              </p>
            </div>

            <div className="bg-[#212528]/80 border border-[#2C3034] p-3.5 rounded-xl space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5D6164] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#C9FF3D]" />
                Status Timeline
              </span>
              <div className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded border ${validityMeta.bg} ${validityMeta.color}`}>
                {validityMeta.text}
              </div>
              <p className="text-[11px] text-[#9A9E9F] font-mono">Expires: {member.expiry_date}</p>
            </div>
          </div>

          {/* Dates Overview */}
          <div className="bg-[#212528]/40 border border-[#2C3034] rounded-xl p-3.5 text-xs grid grid-cols-2 gap-4 font-mono">
            <div>
              <span className="text-[#5D6164] block text-[10px] uppercase">Registered Since</span>
              <span className="text-[#EDEEEA] font-semibold">{member.join_date}</span>
            </div>
            <div>
              <span className="text-[#5D6164] block text-[10px] uppercase">Renewal Due Date</span>
              <span className="text-[#EDEEEA] font-semibold">{member.expiry_date}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-[#2C3034] bg-[#212528]/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-bold text-[#EDEEEA] border border-[#2C3034] hover:bg-[#2C3034] transition-colors"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              onEdit(member);
            }}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Member Details
          </button>
        </div>
      </div>
    </div>
  );
};
