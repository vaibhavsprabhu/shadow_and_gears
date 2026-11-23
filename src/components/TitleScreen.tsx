import {
  Box,
  Compass,
  Lock,
  MapPin,
  Moon,
  Play,
  RotateCcw,
  Sun,
  Unlock,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  buildCityMapBackgroundCanvas,
  drawCityMap2D,
  findCityLocationAtNormalizedCoord,
  type CityMapFootprint,
} from '../game/cityMap2d';
import { getLevelCityAnchor } from '../game/cityMapData';
import { CREW_ROSTER, LEVEL_CONFIGS } from '../game/levels';
import { canDeployLevel, getLevelLockMessage } from '../game/progression';
import type { CrewId } from '../game/types';

interface TitleScreenProps {
  highestUnlocked: number;
  focusedLevelId: number;
  cityNight: boolean;
  cityFootprints: CityMapFootprint[] | null;
  leadCrew: CrewId;
  onSelectFocusedLevel: (levelId: number) => void;
  onToggleCityNight: () => void;
  onSelectLeadCrew: (crew: CrewId) => void;
  onStartLevel: (levelId: number) => void;
  onRestartLevels: () => void;
  onOpenCharacters: () => void;
  onOpenCityMap: (initialLocationId?: number) => void;
}

const PLAYABLE_CREW: CrewId[] = ['roman', 'brock', 'john', 'randy'];

export function TitleScreen({
  highestUnlocked,
  focusedLevelId,
  cityNight,
  cityFootprints,
  leadCrew,
  onSelectFocusedLevel,
  onToggleCityNight,
  onSelectLeadCrew,
  onStartLevel,
  onRestartLevels,
  onOpenCharacters,
  onOpenCityMap,
}: TitleScreenProps) {
  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const focusedConfig =
    LEVEL_CONFIGS.find((l) => l.id === focusedLevelId) ?? LEVEL_CONFIGS[0];
  const focusedAnchor = getLevelCityAnchor(focusedConfig.id);
  const canDeployFocused = canDeployLevel(focusedConfig.id, highestUnlocked);
  const lockMessage = getLevelLockMessage(focusedConfig.id, highestUnlocked);

  const mapBgCanvas = useMemo(
    () => buildCityMapBackgroundCanvas(cityFootprints ?? undefined, 520),
    [cityFootprints]
  );

  useEffect(() => {
    const drawRadar = () => {
      const ctx = radarCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawCityMap2D(ctx, mapBgCanvas, 520, {
        full: false,
        activeLocationId: focusedAnchor.locationId,
        highestUnlocked,
        pulseTimeSec: performance.now() * 0.001,
      });
    };
    drawRadar();
    const id = window.setInterval(drawRadar, 160);
    return () => window.clearInterval(id);
  }, [focusedAnchor.locationId, highestUnlocked, mapBgCanvas]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-4 md:p-7 pointer-events-none select-none overflow-y-auto lg:overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 my-auto">
        {/* Left Launch & Briefing Console */}
        <section
          aria-label="Mission Launch"
          className="w-full lg:w-[415px] shrink-0 pointer-events-auto bg-[#090D16]/92 border border-slate-700/80 rounded-xl p-5 shadow-2xl"
        >
          <div className="flex items-center gap-3.5 mb-3.5">
            <svg
              width="44"
              height="44"
              viewBox="0 0 56 56"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle
                cx="28"
                cy="28"
                r="26"
                stroke="#E5A93B"
                strokeWidth="1.5"
                strokeOpacity="0.45"
              />
              <path
                d="M28 6L30.5 11.2L36.2 10.2L36.8 15.9L42.3 17.5L40.4 23L44.8 26.8L41 31.1L43.1 36.5L37.8 38.9L37.6 44.6L31.9 44.5L28 49.5L24.1 44.5L18.4 44.6L18.2 38.9L12.9 36.5L15 31.1L11.2 26.8L15.6 23L13.7 17.5L19.2 15.9L19.8 10.2L25.5 11.2L28 6Z"
                stroke="#E5A93B"
                strokeWidth="1.75"
                fill="#111827"
              />
              <path
                d="M28 16C22.8 16 19.5 20.5 19.5 26.5C19.5 31.2 22 34.5 28 38C34 34.5 36.5 31.2 36.5 26.5C36.5 20.5 33.2 16 28 16Z"
                fill="#090B10"
                stroke="#F8FAFC"
                strokeWidth="1.5"
              />
              <line x1="22" y1="26" x2="34" y2="26" stroke="#E5A93B" strokeWidth="1.75" />
            </svg>
            <div>
              <p className="text-[11px] font-medium tracking-widest uppercase text-amber-400">
                10-Chapter 3D Tactical Heist
              </p>
              <p className="text-xs text-slate-400">
                Roman · Brock · John · Randy · Static
              </p>
            </div>
          </div>

          <h1
            className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-50 leading-none mb-2.5"
            style={{ textWrap: 'balance' }}
          >
            SHADOWS &amp; GEARS
          </h1>

          <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-4">
            Infiltrate Crown Vault Bank, outmaneuver Inspector Shamus, and survive
            Pablo&apos;s cartel across ten connected city districts.
          </p>

          {/* Lead Operative Selector */}
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1.5">
              Deploy Operative
            </p>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#101520] border border-slate-700/80 rounded">
              {PLAYABLE_CREW.map((id) => {
                const info = CREW_ROSTER[id];
                const active = leadCrew === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onSelectLeadCrew(id)}
                    aria-pressed={active}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-amber-400 text-[#090B10] font-semibold'
                        : 'text-slate-300 hover:text-slate-50 hover:bg-slate-800/80'
                    }`}
                  >
                    {info.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Heist Briefing Box (synced with 3D City Camera) */}
          <div className="p-3.5 rounded-lg bg-[#101624] border border-slate-700/80 mb-4">
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono-tabular uppercase tracking-wider">
              <span className="text-amber-400 font-semibold">
                Level {focusedConfig.id} / 10
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                  canDeployFocused
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'bg-red-500/15 text-red-300 border border-red-500/30'
                }`}
              >
                {canDeployFocused ? (
                  <>
                    <Unlock className="w-3 h-3" aria-hidden="true" />
                    Unlocked
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    Locked
                  </>
                )}
              </span>
            </div>

            <h2 className="text-base font-bold text-slate-50 mt-1">
              {focusedConfig.title}
            </h2>
            <p className="flex items-center gap-1 text-[11px] text-sky-300 mt-0.5">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>{focusedAnchor.districtName}</span>
            </p>
            <p className="text-xs text-slate-300 leading-relaxed mt-1.5">
              {focusedConfig.objectiveSummary}
            </p>

            {lockMessage && (
              <p
                className="mt-2 px-2.5 py-1.5 rounded bg-red-950/50 border border-red-500/35 text-[11px] font-medium text-red-200"
                role="status"
              >
                {lockMessage}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canDeployFocused ? (
                <button
                  type="button"
                  data-start="true"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onStartLevel(focusedConfig.id);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-sm rounded transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                >
                  <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                  Start Heist · Level {focusedConfig.id}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800/80 text-slate-500 border border-slate-700 font-semibold text-xs rounded cursor-not-allowed whitespace-nowrap"
                  >
                    <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    Level {focusedConfig.id} Locked
                  </button>
                  <button
                    type="button"
                    data-start="true"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      onSelectFocusedLevel(highestUnlocked);
                      onStartLevel(highestUnlocked);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-[#090B10] font-semibold text-xs rounded transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                    Start Level {highestUnlocked}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Utility Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCityMap(focusedAnchor.locationId);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#151B26] hover:bg-[#1E2636] text-teal-300 border border-slate-700/80 font-medium text-xs rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              Explore 3D City
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenCharacters();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#151B26] hover:bg-[#1E2636] text-slate-100 border border-slate-700/80 font-medium text-xs rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <Box className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              3D Characters
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onRestartLevels();
              }}
              title="Reset campaign progression back to Level 1"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#151B26] hover:bg-[#1E2636] text-amber-300 border border-slate-700/80 font-medium text-xs rounded transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restart Levels
            </button>
          </div>
        </section>

        {/* Right Combined Heist Levels & City Map Panel */}
        <section
          aria-label="Heist Levels and City Map"
          className="w-full lg:w-[400px] shrink-0 pointer-events-auto bg-[#090D16]/92 border border-slate-700/80 rounded-xl p-4 shadow-2xl flex flex-col gap-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
                3D City Operations · {highestUnlocked}/10 Unlocked
              </p>
              <h2 className="text-sm font-bold text-slate-50">
                Heist Levels &amp; City Map
              </h2>
            </div>

            <button
              type="button"
              onClick={onToggleCityNight}
              aria-label={cityNight ? 'Switch 3D city preview to daylight' : 'Switch 3D city preview to night'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#151C2B] hover:bg-[#1E283D] border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer whitespace-nowrap"
            >
              {cityNight ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                  Day
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
                  Night
                </>
              )}
            </button>
          </div>

          {/* Interactive City Radar synced to 3D City Camera */}
          <div className="flex items-center gap-3 bg-[#0E131E] border border-slate-800 rounded-lg p-2.5">
            <canvas
              ref={radarCanvasRef}
              width={520}
              height={520}
              data-testid="title-city-radar-canvas"
              onClick={(e) => {
                const canvas = radarCanvasRef.current;
                if (!canvas) return;
                const r = canvas.getBoundingClientRect();
                const hit = findCityLocationAtNormalizedCoord(
                  (e.clientX - r.left) / r.width,
                  (e.clientY - r.top) / r.height,
                  22
                );
                if (hit) {
                  onSelectFocusedLevel(hit.primaryLevelId);
                }
              }}
              title="Click a district pin to inspect that level in the 3D City"
              className="w-[148px] h-[148px] shrink-0 rounded border border-white/10 cursor-pointer"
            />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
                3D Camera Focus
              </div>
              <div className="text-xs font-semibold text-slate-100 leading-snug">
                {focusedAnchor.districtName}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                Select any heist below or click a city pin to inspect its 3D district. Levels 2–10 unlock sequentially as you clear each mission.
              </p>
            </div>
          </div>

          {/* 10 Heist Levels Grid */}
          <div
            className="grid grid-cols-2 gap-1.5 max-h-[360px] overflow-y-auto pr-0.5"
            role="list"
            aria-label="Heist Levels"
          >
            {LEVEL_CONFIGS.map((lvl) => {
              const unlocked = canDeployLevel(lvl.id, highestUnlocked);
              const isSelected = lvl.id === focusedConfig.id;
              const anchor = getLevelCityAnchor(lvl.id);
              return (
                <button
                  key={lvl.id}
                  type="button"
                  role="listitem"
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => onSelectFocusedLevel(lvl.id)}
                  className={`flex flex-col items-start px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? unlocked
                        ? 'bg-amber-400/15 border-amber-400 text-slate-50'
                        : 'bg-red-500/12 border-red-400/70 text-slate-200'
                      : unlocked
                        ? 'bg-[#131A29] hover:bg-[#1B2438] border-slate-700/80 text-slate-100'
                        : 'bg-[#0B0F17] hover:bg-[#121723] border-slate-800/80 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between w-full font-mono-tabular text-[10px]">
                    <span className={unlocked ? 'text-amber-400 font-semibold' : 'text-slate-500'}>
                      LEVEL {lvl.id}
                    </span>
                    {!unlocked && (
                      <Lock className="w-3 h-3 text-slate-500" aria-hidden="true" />
                    )}
                  </div>
                  <span className="text-xs font-semibold truncate w-full mt-0.5">
                    {lvl.title}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate w-full">
                    {anchor.districtName.split('·')[0].trim()}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Flat Borderless Bottom Control Hint */}
      <div className="flex items-center justify-between text-xs text-slate-300/85 pointer-events-none pt-3">
        <span>
          Drag backdrop to orbit 3D City · WASD / Arrows Move · Space Action · M Map
        </span>
        <span className="hidden sm:inline text-slate-400">
          Targets: Malhotra &amp; Shasha · Adversaries: Shamus &amp; Pablo
        </span>
      </div>
    </div>
  );
}
