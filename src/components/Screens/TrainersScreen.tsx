import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Users, Star, UserCheck, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Trainer, Member } from '../../types/index.ts';
import { ConfirmDeleteModal } from '../Modals/ConfirmDeleteModal.tsx';

interface TrainersScreenProps {
  trainers: Trainer[];
  members: Member[];
  onAddTrainer: () => void;
  onEditTrainer: (trainer: Trainer) => void;
  onDeleteTrainer: (id: number) => void;
  onSelectMember?: (member: Member) => void;
}

export const TrainersScreen: React.FC<TrainersScreenProps> = ({
  trainers,
  members,
  onAddTrainer,
  onEditTrainer,
  onDeleteTrainer,
  onSelectMember,
}) => {
  const [trainerToDelete, setTrainerToDelete] = useState<Trainer | null>(null);
  const [expandedTrainers, setExpandedTrainers] = useState<Record<number, boolean>>({});

  const toggleExpand = (trainerId: number) => {
    setExpandedTrainers((prev) => ({
      ...prev,
      [trainerId]: !prev[trainerId],
    }));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const totalAssignedClients = members.filter(
    (m) => (m.trainer_id !== null && m.trainer_id !== undefined) || (m.trainer_name && m.trainer_name !== 'Unassigned')
  ).length;

  return (
    <div className="space-y-6">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="font-anton text-3xl tracking-wide text-[#EDEEEA]">Trainers & Coaches</h1>
          <p className="text-xs text-[#9A9E9F] mt-1">
            {trainers.length} active coaches · {totalAssignedClients} total clients assigned across roster
          </p>
        </div>
        <button
          onClick={onAddTrainer}
          className="bg-[#C9FF3D] hover:bg-[#b8eb32] text-[#101214] font-bold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Add trainer
        </button>
      </div>

      {/* Grid of trainer cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {trainers.map((t) => {
          const assignedClients = members.filter(
            (m) =>
              (m.trainer_id !== null && Number(m.trainer_id) === Number(t.id)) ||
              (m.trainer_name && m.trainer_name.toLowerCase() === t.full_name.toLowerCase())
          );

          const isExpanded = !!expandedTrainers[t.id];
          const displayedClients = isExpanded ? assignedClients : assignedClients.slice(0, 3);

          return (
            <div
              key={t.id}
              className="bg-[#1A1D21] border border-[#2C3034] rounded-xl p-5 flex flex-col justify-between hover:border-[#5D6164] transition-all space-y-4 shadow-lg"
            >
              <div>
                {/* Header Profile */}
                <div className="flex items-start justify-between pb-3 border-b border-[#2C3034]">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#212528] border-2 border-[#C9FF3D]/40 flex items-center justify-center font-bold text-xs text-[#EDEEEA] shrink-0">
                      {getInitials(t.full_name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-[#EDEEEA] leading-tight">
                        {t.full_name}
                      </h3>
                      <p className="text-xs text-[#C9FF3D] font-medium mt-0.5">{t.specialty}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-[10px] text-[#5D6164] uppercase tracking-wider bg-[#212528] px-1.5 py-0.2 rounded border border-[#2C3034]">
                          {t.trainer_code}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-[#C9FF3D] font-mono">
                          <Star className="w-3 h-3 fill-[#C9FF3D]" />
                          <span>{t.rating ? t.rating.toFixed(1) : '5.0'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onEditTrainer(t)}
                      title="Edit Coach Details"
                      className="p-1.5 text-[#9A9E9F] hover:text-[#EDEEEA] rounded hover:bg-[#212528] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setTrainerToDelete(t)}
                      title="Remove Trainer"
                      className="p-1.5 text-[#5D6164] hover:text-[#FF5F45] rounded hover:bg-[#FF5F45]/15 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Quick Metric Stats */}
                <div className="grid grid-cols-2 gap-2 py-3 text-xs">
                  <div className="bg-[#212528] p-2.5 rounded-lg border border-[#2C3034]">
                    <span className="text-[10px] uppercase tracking-wider text-[#5D6164] block">Clients Assigned</span>
                    <span className="font-bold text-sm text-[#EDEEEA] font-mono flex items-center gap-1.5 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-[#C9FF3D]" />
                      {assignedClients.length}
                    </span>
                  </div>
                  <div className="bg-[#212528] p-2.5 rounded-lg border border-[#2C3034]">
                    <span className="text-[10px] uppercase tracking-wider text-[#5D6164] block">Sessions / Week</span>
                    <span className="font-bold text-sm text-[#EDEEEA] font-mono flex items-center gap-1.5 mt-0.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#8FB82A]" />
                      {t.sessions_this_week || 16}
                    </span>
                  </div>
                </div>

                {/* Assigned Clients Detailed List */}
                <div className="pt-2 border-t border-[#2C3034]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9E9F] flex items-center gap-1">
                      <Users className="w-3 h-3 text-[#C9FF3D]" />
                      Assigned Clients ({assignedClients.length})
                    </span>
                  </div>

                  {assignedClients.length === 0 ? (
                    <div className="bg-[#212528]/40 border border-[#2C3034] rounded-lg p-3 text-center text-xs text-[#5D6164] flex items-center justify-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>No gym members currently assigned</span>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {displayedClients.map((client) => (
                        <div
                          key={client.id}
                          onClick={() => onSelectMember && onSelectMember(client)}
                          title="Click to view member details"
                          className={`bg-[#212528] hover:bg-[#2C3034] p-2 rounded-lg border border-[#2C3034] flex items-center justify-between transition-colors text-xs ${
                            onSelectMember ? 'cursor-pointer hover:border-[#C9FF3D]/40' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-[#1A1D21] border border-[#2C3034] flex items-center justify-center text-[10px] font-bold text-[#C9FF3D] shrink-0">
                              {getInitials(client.full_name)}
                            </div>
                            <div className="truncate">
                              <span className="font-semibold text-[#EDEEEA] block truncate">{client.full_name}</span>
                              <span className="font-mono text-[10px] text-[#5D6164]">{client.member_id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                client.plan_type === 'Platinum'
                                  ? 'bg-purple-900/30 text-purple-300 border border-purple-800/40'
                                  : client.plan_type === 'Gold'
                                  ? 'bg-[#C9FF3D]/15 text-[#C9FF3D] border border-[#C9FF3D]/30'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              {client.plan_type}
                            </span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                client.status === 'Active'
                                  ? 'bg-[#C9FF3D]'
                                  : client.status === 'Expiring'
                                  ? 'bg-[#FF5F45]'
                                  : 'bg-[#5D6164]'
                              }`}
                              title={client.status}
                            />
                          </div>
                        </div>
                      ))}

                      {assignedClients.length > 3 && (
                        <button
                          onClick={() => toggleExpand(t.id)}
                          className="w-full text-center text-[11px] font-medium text-[#C9FF3D] hover:underline pt-1 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <span>Show fewer</span>
                              <ChevronUp className="w-3 h-3" />
                            </>
                          ) : (
                            <>
                              <span>Show all {assignedClients.length} clients</span>
                              <ChevronDown className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* In-app Confirmation Modal for Trainer Deletion */}
      <ConfirmDeleteModal
        isOpen={!!trainerToDelete}
        title="Remove Staff Trainer"
        message="Are you sure you want to remove this trainer from the system? Any members assigned to this coach will be marked as unassigned in the database."
        itemDetails={trainerToDelete ? `${trainerToDelete.full_name} (${trainerToDelete.trainer_code}) — Specialty: ${trainerToDelete.specialty}` : undefined}
        confirmText="Yes, Remove Trainer"
        onClose={() => setTrainerToDelete(null)}
        onConfirm={() => {
          if (trainerToDelete) {
            onDeleteTrainer(trainerToDelete.id);
            setTrainerToDelete(null);
          }
        }}
      />
    </div>
  );
};
