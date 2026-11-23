import { Eye, Map as MapIcon, MapPin, Moon, Pause, RotateCcw, Sun, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { buildCityMapBackgroundCanvas, drawCityMap2D, type CityMapFootprint } from '../game/cityMap2d';
import { getLevelCityAnchor } from '../game/cityMapData';
import type { HudSnapshot } from '../game/types';

export interface MinimapPlayerPose {
  x: number;
  z: number;
  face: number;
}

interface GameHudProps {
  hud: HudSnapshot;
  muted: boolean;
  cityNight: boolean;
  cameraMode: '3d' | 'top';
  highestUnlocked: number;
  cityFootprints: CityMapFootprint[] | null;
  getMinimapPlayer: () => MinimapPlayerPose | null;
  onToggleMute: () => void;
  onToggleNight: () => void;
  onToggleCameraMode: () => void;
  onOpenCityMap: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export function GameHud({
  hud,
  muted,
  cityNight,
  cameraMode,
  highestUnlocked,
  cityFootprints,
  getMinimapPlayer,
  onToggleMute,
  onToggleNight,
  onToggleCameraMode,
  onOpenCityMap,
  onPause,
  onRestart,
}: GameHudProps) {
  const pct = Math.round(hud.objectiveProgress * 100);
  const anchor = getLevelCityAnchor(hud.levelId);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getMinimapPlayerRef = useRef(getMinimapPlayer);
  getMinimapPlayerRef.current = getMinimapPlayer;

  const mapBgCanvas = useMemo(
    () => buildCityMapBackgroundCanvas(cityFootprints ?? undefined, 450),
    [cityFootprints]
  );

  useEffect(() => {
    const drawMini = () => {
      const ctx = miniCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawCityMap2D(ctx, mapBgCanvas, 136, {
        full: false,
        player: getMinimapPlayerRef.current(),
        activeLocationId: anchor.locationId,
        highestUnlocked,
        pulseTimeSec: performance.now() * 0.001,
      });
    };

    drawMini();
    const id = window.setInterval(drawMini, 140);
    return () => window.clearInterval(id);
  }, [anchor.locationId, highestUnlocked, mapBgCanvas]);

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6 select-none">
      {/* Top Perimeter Clusters */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Chapter, District & Live Objective */}
        <div className="bg-[#090B10]/90 border border-slate-700/60 rounded px-4 py-3 max-w-md">
          <div className="flex items-center gap-2 text-[11px] font-mono-tabular uppercase tracking-wider text-amber-400">
            <span>Level {hud.levelId} / 10</span>
            <span aria-hidden="true">·</span>
            <span>{hud.activeCrewName}</span>
            {hud.canSwitchCrew && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-sky-300">Tab to Switch</span>
              </>
            )}
          </div>
          <h2 className="font-display text-xl font-bold text-slate-50 leading-tight mt-0.5">
            {hud.levelTitle}
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
            <MapPin className="w-3 h-3 text-amber-400/90 shrink-0" aria-hidden="true" />
            <span className="truncate">{anchor.districtName}</span>
          </div>
          <p className="text-xs text-slate-300 mt-1.5 leading-snug">
            {hud.objectiveText}
          </p>
          <div className="mt-2.5 h-1.5 w-full bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-amber-400 origin-left"
              style={{ transform: `scaleX(${Math.max(0.02, hud.objectiveProgress)})` }}
            />
          </div>
        </div>

        {/* Top-Right: Telemetry Readouts + Utility Controls */}
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* Combat HP or Spotted Pips */}
          {hud.levelId === 9 ? (
            <div className="bg-[#090B10]/90 border border-slate-700/60 rounded px-3.5 py-2 flex items-center gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {hud.activeCrewName} HP
                </div>
                <div className="font-mono-tabular text-base font-semibold text-emerald-400">
                  {Math.round(hud.playerHp)} / {hud.playerMaxHp}
                </div>
              </div>
              {hud.bossHp > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Pablo HP
                  </div>
                  <div className="font-mono-tabular text-base font-semibold text-red-400">
                    {Math.round(hud.bossHp)}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#090B10]/90 border border-slate-700/60 rounded px-3.5 py-2 flex items-center gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-400">
                  {hud.levelId === 6 ? 'Hull Hits' : 'Spotted'}
                </div>
                <div className="flex items-center gap-1.5 mt-1" aria-label={`Spotted ${hud.spottedCount} of ${hud.maxSpots}`}>
                  {Array.from({ length: hud.maxSpots }).map((_, idx) => {
                    const hit = idx < hud.spottedCount;
                    return (
                      <svg key={idx} width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          fill={hit ? '#EF4444' : '#0F172A'}
                          stroke={hit ? '#FCA5A5' : '#475569'}
                          strokeWidth="1.5"
                        />
                      </svg>
                    );
                  })}
                  <span className="font-mono-tabular text-xs font-semibold text-slate-200 ml-1">
                    {hud.spottedCount}/{hud.maxSpots}
                  </span>
                </div>
              </div>

              {hud.hasTimer && (
                <div className="border-l border-slate-700/70 pl-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Timer
                  </div>
                  <div
                    className={`font-mono-tabular text-lg font-semibold leading-tight ${
                      hud.timerRemaining <= 10 ? 'text-red-400' : 'text-amber-400'
                    }`}
                  >
                    {hud.timerRemaining}s
                  </div>
                </div>
              )}

              {hud.totalBags > 0 && (
                <div className="border-l border-slate-700/70 pl-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">
                    Cash
                  </div>
                  <div className="font-mono-tabular text-lg font-semibold leading-tight text-emerald-400">
                    {hud.bagsDelivered}/{hud.totalBags}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Square Utility Buttons */}
          <div className="flex items-center gap-1 bg-[#090B10]/90 border border-slate-700/60 rounded p-1">
            <button
              type="button"
              tabIndex={-1}
              aria-label={cameraMode === '3d' ? 'Switch to Overhead Camera [C]' : 'Switch to 3D Camera [C]'}
              title={cameraMode === '3d' ? '3D Chase Camera [C]' : 'Tactical Top Camera [C]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleCameraMode();
              }}
              className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded text-sky-300 hover:text-sky-200 hover:bg-slate-800 transition-colors cursor-pointer text-xs font-semibold"
            >
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">{cameraMode === '3d' ? '3D' : 'Top'}</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Open City Map [M]"
              title="City Map [M]"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCityMap();
              }}
              className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-slate-800 transition-colors cursor-pointer text-xs font-semibold"
            >
              <MapIcon className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Map</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={cityNight ? 'Switch to Day [N]' : 'Switch to Night [N]'}
              title={cityNight ? 'Daylight [N]' : 'Night Mode [N]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleNight();
              }}
              className="w-9 h-9 flex items-center justify-center rounded text-slate-300 hover:text-slate-50 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {cityNight ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-sky-300" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute audio [V]' : 'Mute audio [V]'}
              title={muted ? 'Unmute [V]' : 'Mute [V]'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 flex items-center justify-center rounded text-slate-300 hover:text-slate-50 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Restart level [R]"
              title="Restart Level [R]"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              className="h-9 px-2.5 inline-flex items-center gap-1.5 rounded text-slate-200 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer text-xs font-semibold"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span className="hidden md:inline">Restart</span>
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause mission [P]"
              title="Pause [P]"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 flex items-center justify-center rounded text-slate-300 hover:text-slate-50 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Radio Comms Bar (Left) & Live City Minimap (Right) */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          {hud.dialogue && (
            <div className="bg-[#090B10]/90 border border-slate-700/60 rounded px-4 py-2.5 max-w-xl">
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`font-mono-tabular font-semibold uppercase tracking-wider ${
                    hud.dialogue.tone === 'villain'
                      ? 'text-red-400'
                      : hud.dialogue.tone === 'note'
                        ? 'text-pink-300'
                        : hud.dialogue.tone === 'handler'
                          ? 'text-amber-400'
                          : 'text-sky-400'
                  }`}
                >
                  {hud.dialogue.speaker}
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  /
                </span>
                <span className="text-slate-200 leading-snug">{hud.dialogue.text}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 pointer-events-auto shrink-0">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onOpenCityMap();
            }}
            aria-label="Expand tactical city map [M]"
            title="Expand tactical city map (M)"
            className="hidden sm:block bg-[#090B10]/92 border border-slate-700/80 hover:border-amber-400/70 rounded-lg p-1 transition-colors cursor-pointer group"
          >
            <canvas
              ref={miniCanvasRef}
              width={136}
              height={136}
              data-testid="heist-minimap-canvas"
              className="block rounded"
            />
            <div className="mt-1 px-1 flex items-center justify-between text-[10px] font-mono-tabular text-slate-300 group-hover:text-amber-300">
              <span>CITY MAP</span>
              <span>[M]</span>
            </div>
          </button>

          <div className="hidden md:block text-[11px] font-mono-tabular text-slate-400 bg-[#090B10]/85 border border-slate-800 rounded px-3 py-1">
            {pct}% COMPLETE
          </div>
        </div>
      </div>
    </div>
  );
}
