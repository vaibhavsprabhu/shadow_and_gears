import { Compass, Lock, Moon, Play, Sun, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  buildCityMapBackgroundCanvas,
  drawCityMap2D,
  findCityLocationAtNormalizedCoord,
  type CityMapFootprint,
} from '../game/cityMap2d';
import { CITY_LOCATIONS, getLevelCityAnchor } from '../game/cityMapData';
import type { HudSnapshot } from '../game/types';
import type { MinimapPlayerPose } from './GameHud';

interface HeistCityMapModalProps {
  isOpen: boolean;
  hud: HudSnapshot;
  highestUnlocked: number;
  cityNight: boolean;
  cityFootprints: CityMapFootprint[] | null;
  getMinimapPlayer: () => MinimapPlayerPose | null;
  onClose: () => void;
  onToggleNight: () => void;
  onOpenFreeRoam3D: () => void;
  onSwitchLevel: (levelId: number) => void;
}

export function HeistCityMapModal({
  isOpen,
  hud,
  highestUnlocked,
  cityNight,
  cityFootprints,
  getMinimapPlayer,
  onClose,
  onToggleNight,
  onOpenFreeRoam3D,
  onSwitchLevel,
}: HeistCityMapModalProps) {
  const bigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const getMinimapPlayerRef = useRef(getMinimapPlayer);
  getMinimapPlayerRef.current = getMinimapPlayer;

  const anchor = getLevelCityAnchor(hud.levelId);
  const activeLoc =
    CITY_LOCATIONS.find((l) => l.id === anchor.locationId) ?? CITY_LOCATIONS[0];

  const mapBgCanvas = useMemo(
    () => buildCityMapBackgroundCanvas(cityFootprints ?? undefined, 900),
    [cityFootprints]
  );

  useEffect(() => {
    if (!isOpen) return;
    const drawFull = () => {
      const ctx = bigCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawCityMap2D(ctx, mapBgCanvas, 900, {
        full: true,
        player: getMinimapPlayerRef.current(),
        activeLocationId: anchor.locationId,
        highestUnlocked,
        pulseTimeSec: performance.now() * 0.001,
      });
    };
    drawFull();
    const id = window.setInterval(drawFull, 140);
    return () => window.clearInterval(id);
  }, [anchor.locationId, highestUnlocked, isOpen, mapBgCanvas]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-30 bg-[#050609]/90 flex items-center justify-center p-4 md:p-6 select-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heist-city-map-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-5xl max-h-[92vh] bg-[#0C0F16] border border-slate-700/80 rounded-xl p-4 md:p-5 flex flex-col lg:flex-row gap-4 overflow-hidden">
        {/* Interactive City Map Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center min-w-0">
          <div className="w-full flex items-center justify-between gap-2 mb-2.5">
            <div>
              <p className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
                Tactical City Map · Level {hud.levelId} / 10
              </p>
              <h2
                id="heist-city-map-title"
                className="font-display text-lg md:text-xl font-bold text-slate-50 leading-tight"
              >
                {anchor.districtName}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tactical city map"
              className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <canvas
            ref={bigCanvasRef}
            width={900}
            height={900}
            data-testid="heist-big-map-canvas"
            onClick={(e) => {
              const canvas = bigCanvasRef.current;
              if (!canvas) return;
              const r = canvas.getBoundingClientRect();
              const clicked = findCityLocationAtNormalizedCoord(
                (e.clientX - r.left) / r.width,
                (e.clientY - r.top) / r.height,
                16
              );
              if (!clicked) return;
              if (clicked.id === anchor.locationId || clicked.primaryLevelId === hud.levelId) {
                onClose();
              } else if (clicked.primaryLevelId <= highestUnlocked) {
                onSwitchLevel(clicked.primaryLevelId);
              }
            }}
            className="w-[min(64vh,88vw)] h-[min(64vh,88vw)] lg:w-[min(74vh,520px)] lg:h-[min(74vh,520px)] rounded-lg border border-white/15 cursor-pointer"
          />
          <p className="text-[11px] text-slate-400 mt-2">
            Click an unlocked district pin to deploy · Press <strong className="text-slate-200">M</strong> or{' '}
            <strong className="text-slate-200">Esc</strong> to resume
          </p>
        </div>

        {/* Right Intel & Actions Sidebar */}
        <div className="w-full lg:w-[310px] shrink-0 flex flex-col gap-3 min-h-0">
          <div
            className="bg-[#111622] border rounded-lg p-3.5"
            style={{ borderColor: activeLoc.color }}
          >
            <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
              Active Zone #{activeLoc.id} · {activeLoc.levels}
            </div>
            <div className="text-base font-bold text-slate-50 mt-0.5">{activeLoc.name}</div>
            <p className="text-xs text-slate-300 leading-relaxed mt-1.5">{activeLoc.brief}</p>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-xs cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                Resume Heist [M]
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onOpenFreeRoam3D}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A2233] hover:bg-[#232D42] border border-slate-700 text-sky-300 font-medium text-xs cursor-pointer whitespace-nowrap"
                >
                  <Compass className="w-3.5 h-3.5" aria-hidden="true" />
                  Free-Roam 3D
                </button>
                <button
                  type="button"
                  onClick={onToggleNight}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#1A2233] hover:bg-[#232D42] border border-slate-700 text-slate-200 font-medium text-xs cursor-pointer whitespace-nowrap"
                >
                  {cityNight ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                      Daylight [N]
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                      Night [N]
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* District Index */}
          <div className="flex-1 min-h-[160px] overflow-y-auto bg-[#090B10] border border-slate-800 rounded-lg p-1.5 space-y-0.5">
            {CITY_LOCATIONS.map((loc) => {
              const isCurrent = loc.id === anchor.locationId;
              const locked = loc.primaryLevelId > highestUnlocked;
              return (
                <button
                  key={loc.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (isCurrent || loc.primaryLevelId === hud.levelId) {
                      onClose();
                    } else {
                      onSwitchLevel(loc.primaryLevelId);
                    }
                  }}
                  className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-xs transition-colors ${
                    isCurrent
                      ? 'bg-amber-400/15 text-amber-200 border border-amber-400/40 cursor-pointer'
                      : locked
                        ? 'text-slate-500 opacity-60 cursor-not-allowed'
                        : 'text-slate-200 hover:bg-white/10 cursor-pointer'
                  }`}
                >
                  <span
                    className="shrink-0 w-5 h-5 rounded-full grid place-items-center text-[10px] font-bold text-[#111]"
                    style={{ backgroundColor: locked ? '#475569' : loc.color }}
                  >
                    {loc.id}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium leading-tight">{loc.name}</span>
                    <span className="block text-[10px] text-slate-400">{loc.levels}</span>
                  </span>
                  {locked && <Lock className="w-3 h-3 shrink-0 text-slate-500" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
