import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { CrewId, RoleAssignment } from '../game/types';

interface BlueprintPlannerProps {
  initialRoles: RoleAssignment;
  onConfirmPlan: (roles: RoleAssignment) => void;
}

const OPERATIVES: { id: CrewId; label: string }[] = [
  { id: 'roman', label: 'Roman (P1 · The Ghost)' },
  { id: 'brock', label: 'Brock (P2 · Hacker)' },
  { id: 'john', label: 'John (P3 · Muscle)' },
  { id: 'randy', label: 'Randy (P4 · Driver)' },
];

export function BlueprintPlanner({
  initialRoles,
  onConfirmPlan,
}: BlueprintPlannerProps) {
  const [plateA, setPlateA] = useState<CrewId>(initialRoles.plateA);
  const [plateB, setPlateB] = useState<CrewId>(initialRoles.plateB);
  const [driver, setDriver] = useState<CrewId>(initialRoles.driver);
  const [error, setError] = useState('');

  const handleConfirm = () => {
    const unique = new Set([plateA, plateB, driver]);
    if (unique.size < 3) {
      setError('Assign three different crew members to Plate A, Plate B, and Getaway Driver.');
      return;
    }
    setError('');
    onConfirmPlan({ plateA, plateB, driver });
  };

  return (
    <div className="fixed bottom-4 right-4 z-20 w-72 bg-[#0B111C] border border-emerald-500/40 rounded p-4 shadow-2xl pointer-events-auto">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] font-mono-tabular uppercase tracking-wider text-emerald-400">
            Green Route · Vault Briefing
          </p>
          <h3 className="font-display text-xl font-bold text-slate-50">
            Assign Heist Roles
          </h3>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div>
          <label htmlFor="select-plate-a" className="block text-slate-300 font-medium mb-1">
            Pressure Plate A (North)
          </label>
          <select
            id="select-plate-a"
            value={plateA}
            onChange={(e) => setPlateA(e.target.value as CrewId)}
            className="w-full bg-[#131C2B] border border-slate-700 rounded px-3 py-2 text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {OPERATIVES.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="select-plate-b" className="block text-slate-300 font-medium mb-1">
            Pressure Plate B (South)
          </label>
          <select
            id="select-plate-b"
            value={plateB}
            onChange={(e) => setPlateB(e.target.value as CrewId)}
            className="w-full bg-[#131C2B] border border-slate-700 rounded px-3 py-2 text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {OPERATIVES.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="select-driver" className="block text-slate-300 font-medium mb-1">
            Getaway Van Driver
          </label>
          <select
            id="select-driver"
            value={driver}
            onChange={(e) => setDriver(e.target.value as CrewId)}
            className="w-full bg-[#131C2B] border border-slate-700 rounded px-3 py-2 text-slate-100 focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            {OPERATIVES.map((op) => (
              <option key={op.id} value={op.id}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        data-start="true"
        onClick={handleConfirm}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
      >
        Confirm Plan &amp; Start Level 4
        <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
