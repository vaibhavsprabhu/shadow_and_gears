import { ArrowRight, Home, Play, RotateCcw } from 'lucide-react';
import type { AppScreenState, HudSnapshot } from '../game/types';

interface StatusModalsProps {
  screenState: AppScreenState;
  hud: HudSnapshot;
  onResume: () => void;
  onRestart: () => void;
  onRestartLevels: () => void;
  onNextLevel: () => void;
  onReturnTitle: () => void;
}

export function StatusModals({
  screenState,
  hud,
  onResume,
  onRestart,
  onRestartLevels,
  onNextLevel,
  onReturnTitle,
}: StatusModalsProps) {
  if (screenState !== 'paused' && screenState !== 'gameover') {
    return null;
  }

  const isPaused = screenState === 'paused';
  const isVictory = hud.outcome === 'victory';
  const isCutscene = hud.outcome === 'cutscene';
  const isFinale = hud.outcome === 'finale';
  const isBusted = hud.outcome === 'busted';

  let kicker = 'Mission Paused';
  let title = hud.levelTitle;
  let accentClass = 'border-slate-700';

  if (isVictory) {
    kicker = `Level ${hud.levelId} Complete`;
    title = 'Operation Clean';
    accentClass = 'border-emerald-500/45';
  } else if (isCutscene) {
    kicker = 'Cutscene · Level 6';
    title = 'The Mistake';
    accentClass = 'border-red-500/50';
  } else if (isFinale) {
    kicker = 'Level 10 Finale';
    title = 'To Be Continued...';
    accentClass = 'border-amber-400/55';
  } else if (isBusted) {
    kicker = `Level ${hud.levelId} Failed`;
    title = 'Cover Blown';
    accentClass = 'border-red-500/50';
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-6 bg-[#07090D]/80"
      role="dialog"
      aria-modal="true"
      aria-labelledby="status-modal-title"
    >
      <div
        className={`w-full max-w-xl bg-[#0F141F] border ${accentClass} rounded-lg p-7 shadow-2xl`}
      >
        <p className="text-xs font-mono-tabular uppercase tracking-widest text-amber-400">
          {kicker}
        </p>
        <h2
          id="status-modal-title"
          className="font-display text-3xl md:text-4xl font-bold text-slate-50 mt-1"
        >
          {title}
        </h2>

        <p className="mt-3 text-sm text-slate-300 leading-relaxed">
          {isPaused
            ? `Currently on Level ${hud.levelId}: ${hud.levelTitle}.`
            : hud.outcomeReason}
        </p>

        {isCutscene && (
          <div className="mt-4 p-4 bg-[#171117] border border-red-500/30 rounded text-sm space-y-2">
            <p className="text-amber-300 font-medium">
              STATIC: &ldquo;John, NO, his family&apos;s in that car—&rdquo;
            </p>
            <p className="text-slate-400 italic">(Silence.)</p>
            <p className="text-red-400 font-semibold">
              SHAMUS: &ldquo;You took everything from me.&rdquo;
            </p>
          </div>
        )}

        {isFinale && (
          <div className="mt-4 p-4 bg-[#141923] border border-amber-400/30 rounded text-sm space-y-2">
            <p className="text-sky-300">
              BROCK: &ldquo;Pablo&apos;s down! Where&apos;s Shamus?&rdquo;
            </p>
            <p className="text-amber-300">
              STATIC: &ldquo;He&apos;s gone. He was never inside.&rdquo;
            </p>
            <p className="text-red-400 font-semibold">
              SHAMUS (radio): &ldquo;This isn&apos;t over, Roman. I&apos;ll be waiting.&rdquo;
            </p>
          </div>
        )}

        {/* Tabular Run Metrics */}
        <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-800">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Level
            </div>
            <div className="font-mono-tabular text-lg font-semibold text-slate-100">
              {hud.levelId} / 10
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Elapsed
            </div>
            <div className="font-mono-tabular text-lg font-semibold text-slate-100">
              {Math.round(hud.elapsed)}s
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-400">
              Spotted
            </div>
            <div className="font-mono-tabular text-lg font-semibold text-slate-100">
              {hud.spottedCount} / {hud.maxSpots}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-6">
          {isPaused && (
            <button
              type="button"
              data-start="true"
              onClick={onResume}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4 fill-current" aria-hidden="true" />
              Resume
            </button>
          )}

          {(isVictory || isCutscene) && hud.levelId < 10 && (
            <button
              type="button"
              data-start="true"
              onClick={onNextLevel}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              Next: Level {hud.levelId + 1}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          {(isBusted || isFinale) && (
            <button
              type="button"
              data-start="true"
              onClick={onRestart}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              {isFinale ? 'Replay Level 10' : 'Try Again'}
            </button>
          )}

          {!isBusted && !isFinale && (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#18202E] hover:bg-[#222C3F] text-slate-100 border border-slate-700 font-medium text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Restart Level
            </button>
          )}

          <button
            type="button"
            onClick={onRestartLevels}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#18202E] hover:bg-[#222C3F] text-amber-300 border border-slate-700 font-medium text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Restart Levels
          </button>

          <button
            type="button"
            onClick={onReturnTitle}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700/70 font-medium text-sm rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Title
          </button>
        </div>
      </div>
    </div>
  );
}
