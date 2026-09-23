import { Howl, Howler } from 'howler';

export type CueTiming = number | { start: number; duration?: number; end?: number };

export interface SlideCueMap {
  [cueId: string]: CueTiming;
}

export interface CueItem {
  cueId: string;
  start: number;
  duration: number;
  end?: number;
}

export type SlideEntryMode = 'full' | 'start' | 'last-cue';

export interface SetSlideOptions {
  shouldPlay?: boolean;
  entryMode?: SlideEntryMode;
}

export interface SlideData {
  id: string;
  audioUrl?: string;
  cues?: SlideCueMap;
}

interface NavigatorWithAudioSession extends Navigator {
  audioSession?: {
    type?: string;
  };
}

function getCueTiming(val: CueTiming | undefined): { start: number; duration: number; end?: number } {
  if (val === undefined) return { start: 0, duration: 0.5 };
  if (typeof val === 'number') {
    return { start: val, duration: 0.5 };
  }
  return {
    start: val.start,
    duration: val.duration ?? 0.5,
    end: val.end
  };
}

export class AudioSyncController {
  private slides: SlideData[] = [];
  private currentIndex: number = 0;
  private currentEntryMode: SlideEntryMode = 'full';
  private currentHowl: Howl | null = null;
  private nextHowl: Howl | null = null;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  private triggeredCues: Set<string> = new Set();
  private exitedCues: Set<string> = new Set();
  private manualTime: number = 0;
  private rafId: number | null = null;
  private onSlideChangeCallback?: (index: number) => void;
  private onProgressCallback?: (currentSec: number, totalSec: number) => void;
  private onPlayStateChangeCallback?: (isPlaying: boolean) => void;
  private onCuesLoadedCallback?: (cues: CueItem[], totalSec: number) => void;

  constructor(
    slides: SlideData[],
    options?: {
      onSlideChange?: (index: number) => void;
      onProgress?: (currentSec: number, totalSec: number) => void;
      onPlayStateChange?: (isPlaying: boolean) => void;
      onCuesLoaded?: (cues: CueItem[], totalSec: number) => void;
    }
  ) {
    this.slides = slides;
    this.onSlideChangeCallback = options?.onSlideChange;
    this.onProgressCallback = options?.onProgress;
    this.onPlayStateChangeCallback = options?.onPlayStateChange;
    this.onCuesLoadedCallback = options?.onCuesLoaded;
  }

  public getCurrentSlideIndex(): number {
    return this.currentIndex;
  }

  public getCurrentEntryMode(): SlideEntryMode {
    return this.currentEntryMode;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public setSlideIndex(index: number, options?: boolean | SetSlideOptions) {
    if (index < 0 || index >= this.slides.length) return;

    const opts: SetSlideOptions = typeof options === 'boolean'
      ? { shouldPlay: options, entryMode: options ? 'start' : 'full' }
      : (options ?? { shouldPlay: false, entryMode: 'full' });

    const shouldPlay = opts.shouldPlay ?? this.isPlaying;
    const entryMode = opts.entryMode ?? (shouldPlay ? 'start' : 'full');

    this.currentIndex = index;
    this.currentEntryMode = entryMode;
    this.triggeredCues.clear();
    this.exitedCues.clear();

    this.stopTickLoop();

    // Forcefully stop all audio globally in Howler to avoid rogue parallel tracks
    Howler.stop();

    if (this.currentHowl) {
      this.currentHowl.off();
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }

    if (this.nextHowl) {
      this.nextHowl.off();
      this.nextHowl.stop();
      this.nextHowl.unload();
      this.nextHowl = null;
    }

    if (!shouldPlay) {
      this.isPlaying = false;
      this.notifyPlayState(false);
    }

    // Auto-bind slide cues (unassigned <mark> or boxes)
    this.bindSlideCues(index);

    const slide = this.slides[index];
    const slideEl = document.querySelector(`.reveal .slides section[data-slide-index="${index}"]`);
    const baseFrame = slideEl?.querySelector('.slide-base-frame');

    if (entryMode === 'full') {
      this.manualTime = 99999;
      if (baseFrame) {
        baseFrame.classList.add('no-intro-transition');
        baseFrame.classList.remove('is-intro-state');
        baseFrame.classList.remove('is-entering');
        void (baseFrame as HTMLElement).offsetWidth;
        baseFrame.classList.remove('no-intro-transition');
      }
      this.fastForwardAllCues();
    } else if (entryMode === 'last-cue') {
      const cues = this.getCurrentSlideCues();
      const lastCue = cues[cues.length - 1];
      if (lastCue) {
        this.manualTime = lastCue.start;
        this.syncCuesToTime(lastCue.start);
      } else {
        this.manualTime = 99999;
        this.fastForwardAllCues();
      }
    } else {
      // 'start': reset all cues to unrevealed
      this.manualTime = 0;
      this.resetAllCues();
      if (baseFrame && index > 0) {
        // Instantly position centered without flying in from top-left
        baseFrame.classList.add('no-intro-transition');
        baseFrame.classList.add('is-intro-state');
        baseFrame.classList.add('is-entering');
        void (baseFrame as HTMLElement).offsetWidth;
        baseFrame.classList.remove('no-intro-transition');

        // Clean up is-entering after animation completes so rewinding on same slide won't re-trigger fade-in
        setTimeout(() => {
          baseFrame.classList.remove('is-entering');
        }, 1500);
      }
    }
    this.updateSlideIntroState();

    if (slide?.audioUrl) {
      this.loadSlideAudio(slide, shouldPlay, entryMode);
      this.preloadNextSlideAudio(index + 1);
    }

    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(index);
    }

    if (this.onCuesLoadedCallback) {
      this.onCuesLoadedCallback(this.getCurrentSlideCues(), 0);
    }
  }

  public updateSlideIntroState() {
    const slideEl = document.querySelector(`.reveal .slides section[data-slide-index="${this.currentIndex}"]`);
    if (!slideEl) return;
    const baseFrame = slideEl.querySelector('.slide-base-frame');
    if (!baseFrame) return;

    // Slide 1 (title slide) is never in intro state because it's already a dedicated hero slide
    if (this.currentIndex === 0) {
      baseFrame.classList.remove('is-intro-state');
      baseFrame.classList.remove('is-entering');
      return;
    }

    // If in 'full' mode: NOT in intro state
    if (this.currentEntryMode === 'full') {
      baseFrame.classList.remove('is-intro-state');
      baseFrame.classList.remove('is-entering');
      return;
    }

    // Check if any stage content cue has been triggered.
    // Subtitle reveal ('sub') and subtitle highlights ('hl-sub-*', 'mark-sub-*')
    // are part of the centered intro orientation.
    // The slide only leaves intro state when the first actual STAGE cue is triggered!
    let hasStageCueTriggered = false;
    for (const cueId of this.triggeredCues) {
      if (cueId === 'sub' || cueId.startsWith('hl-sub') || cueId.startsWith('mark-sub')) {
        continue;
      }
      const el = this.getCueElement(cueId);
      if (el) {
        if (el.closest('.slide-header')) {
          continue;
        }
        if (el.closest('.slide-main-stage')) {
          hasStageCueTriggered = true;
          break;
        }
      }
      // If cue element is not inside .slide-header and not a subtitle cue, it's a stage cue
      hasStageCueTriggered = true;
      break;
    }

    if (hasStageCueTriggered) {
      baseFrame.classList.remove('is-intro-state');
      baseFrame.classList.remove('is-entering');
    } else {
      // In 'start' mode without stage cues triggered: INTRO STATE ACTIVE!
      // (Title alone, or Title + Subtitle centered together)
      baseFrame.classList.add('is-intro-state');
    }
  }

  private resetAllCues() {
    this.triggeredCues.clear();
    this.exitedCues.clear();
    const slide = this.slides[this.currentIndex];
    if (slide?.cues) {
      for (const cueId of Object.keys(slide.cues)) {
        this.resetElement(cueId);
      }
    }
    const slideEl = document.querySelector(`.reveal .slides section[data-slide-index="${this.currentIndex}"]`);
    if (slideEl) {
      slideEl.querySelectorAll<HTMLElement>('[data-cue], .cue-target').forEach((el) => {
        el.classList.remove('is-active', 'is-dimmed', 'is-exited');
      });
      slideEl.querySelectorAll<HTMLElement>('mark, .highlight-marker').forEach((el) => {
        el.classList.remove('is-active', 'is-dimmed');
      });
    }
    this.updateSlideIntroState();
  }

  private loadSlideAudio(slide: SlideData, autoPlay: boolean, entryMode: SlideEntryMode = 'full') {
    if (!slide.audioUrl) {
      this.isPlaying = false;
      this.notifyPlayState(false);
      return;
    }

    this.isPlaying = autoPlay;
    this.notifyPlayState(autoPlay);

    const thisSlideIndex = this.currentIndex;
    const howlInstance = new Howl({
      src: [slide.audioUrl],
      html5: false, // Use Web Audio API for exact duration & timing without streaming bugs
      rate: this.playbackRate,
      onload: () => {
        // Concurrency guard: If user navigated away or instance was replaced, abort immediately
        if (this.currentIndex !== thisSlideIndex || this.currentHowl !== howlInstance) {
          howlInstance.off();
          howlInstance.stop();
          howlInstance.unload();
          return;
        }

        const total = howlInstance.duration();
        const totalSec = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;
        
        if (entryMode === 'full') {
          this.manualTime = totalSec;
          howlInstance.seek(totalSec);
          if (this.onProgressCallback) {
            this.onProgressCallback(totalSec, totalSec);
          }
          if (this.onCuesLoadedCallback) {
            this.onCuesLoadedCallback(this.getCurrentSlideCues(), totalSec);
          }
        } else if (entryMode === 'last-cue') {
          const cues = this.getCurrentSlideCues();
          const lastCue = cues[cues.length - 1];
          const targetTime = lastCue ? lastCue.start : 0;
          this.manualTime = targetTime;
          howlInstance.seek(targetTime);
          this.syncCuesToTime(targetTime);
          if (this.onProgressCallback) {
            this.onProgressCallback(targetTime, totalSec);
          }
          if (this.onCuesLoadedCallback) {
            this.onCuesLoadedCallback(cues, totalSec);
          }
        } else {
          // 'start': 0:00 and all cues inactive
          this.manualTime = 0;
          howlInstance.seek(0);
          if (this.onProgressCallback) {
            this.onProgressCallback(0, totalSec);
          }
          if (this.onCuesLoadedCallback) {
            this.onCuesLoadedCallback(this.getCurrentSlideCues(), totalSec);
          }
        }

        // NOTE: If autoPlay was requested, howlInstance.play() was already called upon creation.
        // Howler queues playback automatically and starts once loaded.
        // Do NOT call play() here, as that would spawn duplicate simultaneous audio voices!
      },
      onplay: () => {
        if (this.currentIndex !== thisSlideIndex || this.currentHowl !== howlInstance) {
          howlInstance.off();
          howlInstance.stop();
          howlInstance.unload();
          return;
        }
        this.isPlaying = true;
        this.notifyPlayState(true);
        this.startTickLoop();
      },
      onpause: () => {
        if (this.currentIndex !== thisSlideIndex || this.currentHowl !== howlInstance) return;
        this.isPlaying = false;
        this.notifyPlayState(false);
        this.stopTickLoop();
      },
      onstop: () => {
        if (this.currentIndex !== thisSlideIndex || this.currentHowl !== howlInstance) return;
        this.isPlaying = false;
        this.notifyPlayState(false);
        this.stopTickLoop();
      },
      onend: () => {
        if (this.currentIndex !== thisSlideIndex || this.currentHowl !== howlInstance) return;
        this.stopTickLoop();
        // Trigger all remaining cues so the slide ends in completed state
        this.fastForwardAllCues();
        // Advance to next slide automatically if we were playing
        if (this.currentIndex < this.slides.length - 1) {
          this.setSlideIndex(this.currentIndex + 1, { shouldPlay: true, entryMode: 'start' });
        } else {
          this.isPlaying = false;
          this.notifyPlayState(false);
        }
      }
    });

    this.currentHowl = howlInstance;

    if (autoPlay) {
      howlInstance.play();
    }
  }

  private preloadNextSlideAudio(nextIndex: number) {
    if (nextIndex >= this.slides.length) return;
    const nextSlide = this.slides[nextIndex];
    if (!nextSlide?.audioUrl) return;

    if (this.nextHowl) {
      this.nextHowl.off();
      this.nextHowl.stop();
      this.nextHowl.unload();
      this.nextHowl = null;
    }

    this.nextHowl = new Howl({
      src: [nextSlide.audioUrl],
      html5: false,
      preload: true
    });
  }

  /**
   * Unlocks iOS Safari audio playback and bypasses the physical silent switch.
   * Web Audio defaults to 'ambient' category on iOS, muting output if the silent switch is active.
   * Setting navigator.audioSession.type = 'playback' (iOS 17+) moves it to the media channel.
   * Resumes suspended AudioContext and plays a micro silent buffer for legacy iOS.
   */
  public unlockAudioSession(): void {
    if (typeof window === 'undefined') return;

    // 1. Modern iOS (iOS 17+) AudioSession API
    const nav = navigator as NavigatorWithAudioSession;
    if (nav.audioSession) {
      try {
        nav.audioSession.type = 'playback';
      } catch {
        // Ignore unsupported environments
      }
    }

    // 2. Resume suspended WebAudio AudioContext
    try {
      if (Howler.ctx && Howler.ctx.state === 'suspended') {
        Howler.ctx.resume().catch(() => {});
      }
    } catch {
      // Ignore
    }

    // 3. Fallback for legacy iOS (< 17): trigger short silent HTML5 audio
    try {
      const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
      silentAudio.play().catch(() => {});
    } catch {
      // Ignore
    }
  }

  public play() {
    this.unlockAudioSession();
    if (this.isPlaying && this.currentHowl?.playing()) {
      return;
    }
    if (this.currentHowl) {
      const current = this.currentHowl.seek();
      const currentSec = typeof current === 'number' ? current : 0;
      const total = this.currentHowl.duration();
      const totalSec = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;

      // If in 'full' mode or near the end, restart from beginning in 'start' mode
      if (this.currentEntryMode === 'full' || (totalSec > 0 && currentSec >= totalSec - 0.5)) {
        this.currentEntryMode = 'start';
        this.currentHowl.seek(0);
        this.resetAllCues();
      } else if (currentSec < 0.2) {
        this.resetAllCues();
      }
      if (!this.currentHowl.playing()) {
        this.currentHowl.play();
      }
    } else {
      this.setSlideIndex(this.currentIndex, { shouldPlay: true, entryMode: 'start' });
    }
  }

  public pause() {
    if (this.currentHowl && this.currentHowl.playing()) {
      this.currentHowl.pause();
    } else {
      Howler.stop();
      this.isPlaying = false;
      this.notifyPlayState(false);
      this.stopTickLoop();
    }
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(targetSec: number) {
    this.unlockAudioSession();
    this.currentEntryMode = 'start';
    this.manualTime = targetSec;
    if (this.currentHowl) {
      this.currentHowl.seek(targetSec);
      this.syncCuesToTime(targetSec);
      if (this.onProgressCallback) {
        const total = this.currentHowl.duration();
        const totalSec = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;
        this.onProgressCallback(targetSec, totalSec);
      }
    } else {
      this.syncCuesToTime(targetSec);
    }
  }

  public getCurrentSlideCues(): CueItem[] {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return [];
    return Object.entries(slide.cues)
      .map(([cueId, val]) => {
        const timing = getCueTiming(val);
        return { cueId, ...timing };
      })
      .sort((a, b) => a.start - b.start);
  }

  public getDuration(): number {
    const total = this.currentHowl?.duration();
    return (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;
  }

  public getCurrentTime(): number {
    if (this.currentHowl && this.currentHowl.state() === 'loaded') {
      const current = this.currentHowl.seek();
      if (typeof current === 'number' && Number.isFinite(current) && current >= 0) {
        this.manualTime = current;
        return current;
      }
    }
    return this.manualTime;
  }

  public seekToCue(cueId: string) {
    const cues = this.getCurrentSlideCues();
    const target = cues.find(c => c.cueId === cueId);
    if (target) {
      this.seek(target.start);
    }
  }

  public prevCue() {
    const cues = this.getCurrentSlideCues();

    // If on a slide with no cues:
    if (cues.length === 0) {
      if (this.currentIndex > 0) {
        this.setSlideIndex(this.currentIndex - 1, { entryMode: 'last-cue', shouldPlay: this.isPlaying });
      }
      return;
    }

    // If current slide was entered in 'full' mode:
    // Stepping back should jump to the last cue
    if (this.currentEntryMode === 'full') {
      const lastCue = cues[cues.length - 1];
      if (lastCue) {
        this.seek(lastCue.start);
      }
      return;
    }

    const currentSec = this.getCurrentTime();
    const milestones = [0, ...cues.map(c => c.start)].sort((a, b) => a - b);

    // If already at beginning of slide (no cues active or currentSec <= 0.2s):
    if ((this.triggeredCues.size === 0 || currentSec <= 0.2) && this.currentIndex > 0) {
      // Step back to previous slide at its last cue
      this.setSlideIndex(this.currentIndex - 1, { entryMode: 'last-cue', shouldPlay: this.isPlaying });
      return;
    }

    // Find highest milestone strictly less than currentSec - 0.4s threshold
    let target = 0;
    for (let i = milestones.length - 1; i >= 0; i--) {
      if (milestones[i] < currentSec - 0.4) {
        target = milestones[i];
        break;
      }
    }

    this.seek(target);
  }

  public nextCue() {
    const cues = this.getCurrentSlideCues();

    // If on a slide with no cues:
    if (cues.length === 0) {
      if (this.currentIndex < this.slides.length - 1) {
        this.setSlideIndex(this.currentIndex + 1, { entryMode: 'start', shouldPlay: this.isPlaying });
      }
      return;
    }

    // If current slide was entered in 'full' mode (all cues already revealed):
    // Clicking nextCue means advance to next slide in presentation mode!
    if (this.currentEntryMode === 'full') {
      if (this.currentIndex < this.slides.length - 1) {
        this.setSlideIndex(this.currentIndex + 1, { entryMode: 'start', shouldPlay: this.isPlaying });
      }
      return;
    }

    const currentSec = this.getCurrentTime();
    // Find the first cue with start time strictly greater than currentSec + 0.15s
    const nextCue = cues.find(c => c.start > currentSec + 0.15);
    if (nextCue) {
      this.seek(nextCue.start);
    } else {
      // Past the last cue on this slide -> advance to next slide in 'start' mode
      if (this.currentIndex < this.slides.length - 1) {
        this.setSlideIndex(this.currentIndex + 1, { entryMode: 'start', shouldPlay: this.isPlaying });
      } else {
        // Last slide -> jump to end
        const dur = this.getDuration();
        if (dur > 0) this.seek(dur);
      }
    }
  }

  public setRate(rate: number) {
    this.playbackRate = rate;
    if (this.currentHowl) {
      this.currentHowl.rate(rate);
    }
  }

  private bindSlideCues(index: number) {
    const slide = this.slides[index];
    if (!slide?.cues) return;

    const slideEl = document.querySelector<HTMLElement>(`.reveal .slides section[data-slide-index="${index}"]`);
    if (!slideEl) return;

    // Collect unassigned marks/highlights and boxes
    const unassignedMarks = Array.from(
      slideEl.querySelectorAll<HTMLElement>('mark:not([data-cue]), .highlight-marker:not([data-cue])')
    );
    const unassignedBoxes = Array.from(
      slideEl.querySelectorAll<HTMLElement>('.bento-card-root:not([data-cue]), .step-card:not([data-cue]), .bento-card-object:not([data-cue])')
    );

    for (const cueId of Object.keys(slide.cues)) {
      const existing = slideEl.querySelector(`[data-cue="${cueId}"], #${cueId}`);
      if (existing) continue;

      if (cueId.startsWith('hl-') || cueId.startsWith('mark-')) {
        const nextMark = unassignedMarks.shift();
        if (nextMark) {
          nextMark.setAttribute('data-cue', cueId);
          if (!nextMark.id) nextMark.id = cueId;
        }
      } else if (cueId.startsWith('box-') || cueId.startsWith('card-') || cueId.startsWith('step-') || cueId.startsWith('col-')) {
        const nextBox = unassignedBoxes.shift();
        if (nextBox) {
          nextBox.setAttribute('data-cue', cueId);
          if (!nextBox.id) nextBox.id = cueId;
        }
      }
    }
  }

  private getCueElement(cueId: string): HTMLElement | null {
    const slideEl = document.querySelector<HTMLElement>(`.reveal .slides section[data-slide-index="${this.currentIndex}"]`);
    if (slideEl) {
      const scoped = slideEl.querySelector<HTMLElement>(`#${cueId}, [data-cue="${cueId}"]`);
      if (scoped) return scoped;
    }
    return document.getElementById(cueId) || document.querySelector<HTMLElement>(`[data-cue="${cueId}"]`);
  }

  private startTickLoop() {
    this.stopTickLoop();

    const tick = () => {
      if (this.currentHowl && this.currentHowl.playing()) {
        const current = this.currentHowl.seek();
        const currentSec = (typeof current === 'number' && Number.isFinite(current)) ? current : this.manualTime;
        this.manualTime = currentSec;
        const total = this.currentHowl.duration();
        const totalSec = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;

        if (this.onProgressCallback) {
          this.onProgressCallback(currentSec, totalSec);
        }

        this.checkCues(currentSec);
      }
      this.rafId = requestAnimationFrame(tick);
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopTickLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private checkCues(currentSec: number) {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;

    for (const [cueId, cueVal] of Object.entries(slide.cues)) {
      const timing = getCueTiming(cueVal);

      // Entrance animation (fade in)
      if (currentSec >= timing.start && !this.triggeredCues.has(cueId)) {
        this.triggeredCues.add(cueId);
        this.triggerAnimation(cueId, timing);
        this.updateSlideIntroState();
      }

      // Exit animation (fade out via {/cue} on boxes)
      if (timing.end !== undefined && currentSec >= timing.end && !this.exitedCues.has(cueId)) {
        this.exitedCues.add(cueId);
        this.triggerExit(cueId);
      }
    }

    this.updateHighlightSpotlight(currentSec);
  }

  private syncCuesToTime(currentSec: number) {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;

    for (const [cueId, cueVal] of Object.entries(slide.cues)) {
      const timing = getCueTiming(cueVal);
      if (currentSec >= timing.start) {
        this.triggeredCues.add(cueId);
        if (timing.end !== undefined && currentSec >= timing.end) {
          this.exitedCues.add(cueId);
        } else {
          this.exitedCues.delete(cueId);
        }
        this.fastForwardElement(cueId, timing, currentSec);
      } else {
        this.triggeredCues.delete(cueId);
        this.exitedCues.delete(cueId);
        this.resetElement(cueId);
      }
    }
    this.updateStructuralSpotlight(currentSec);
    this.updateHighlightSpotlight(currentSec);
    this.updateSlideIntroState();
  }

  private updateStructuralSpotlight(currentSec: number) {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;

    // Collect all structural cues for this slide
    const structuralItems: Array<{ cueId: string; el: HTMLElement; start: number; end?: number }> = [];

    for (const [cueId, cueVal] of Object.entries(slide.cues)) {
      const el = this.getCueElement(cueId);
      if (!el) continue;
      const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
      if (isHighlight) continue;

      if (el.dataset.dim === 'false' || el.classList.contains('no-dim')) {
        continue;
      }

      const timing = getCueTiming(cueVal);
      structuralItems.push({ cueId, el, start: timing.start, end: timing.end });
    }

    if (structuralItems.length === 0) return;

    structuralItems.sort((a, b) => a.start - b.start);

    // Find all structural items that have started by currentSec
    const triggered = structuralItems.filter(item => currentSec >= item.start);
    if (triggered.length === 0) {
      for (const item of structuralItems) {
        item.el.classList.remove('is-active', 'is-dimmed', 'is-exited');
      }
      return;
    }

    // The most recently triggered structural item is the active spotlight
    const activeItem = triggered[triggered.length - 1];

    for (const item of structuralItems) {
      if (currentSec < item.start) {
        item.el.classList.remove('is-active', 'is-dimmed', 'is-exited');
      } else if (item.el === activeItem.el) {
        if (item.end !== undefined && currentSec >= item.end && item.el.dataset.exit === 'hide') {
          item.el.classList.remove('is-active', 'is-dimmed');
          item.el.classList.add('is-exited');
        } else {
          item.el.classList.remove('is-dimmed', 'is-exited');
          item.el.classList.add('is-active');
        }
      } else {
        // Earlier triggered item: dimmed spotlight
        if (item.end !== undefined && currentSec >= item.end && item.el.dataset.exit === 'hide') {
          item.el.classList.remove('is-active', 'is-dimmed');
          item.el.classList.add('is-exited');
        } else {
          item.el.classList.remove('is-exited');
          item.el.classList.add('is-active', 'is-dimmed');
        }
      }
    }
  }

  private updateHighlightSpotlight(currentSec: number) {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;

    // Collect all highlight cues for this slide
    const highlightItems: Array<{ cueId: string; el: HTMLElement; start: number; end?: number }> = [];

    for (const [cueId, cueVal] of Object.entries(slide.cues)) {
      const el = this.getCueElement(cueId);
      if (!el) continue;
      const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
      if (!isHighlight) continue;

      const timing = getCueTiming(cueVal);
      highlightItems.push({ cueId, el, start: timing.start, end: timing.end });
    }

    if (highlightItems.length === 0) return;

    highlightItems.sort((a, b) => a.start - b.start);

    // Find all highlight items that have started by currentSec
    const triggered = highlightItems.filter(item => currentSec >= item.start);
    if (triggered.length === 0) {
      for (const item of highlightItems) {
        item.el.classList.remove('is-active', 'is-dimmed');
      }
      return;
    }

    // The most recently triggered highlight item is the active spotlight
    const activeItem = triggered[triggered.length - 1];

    for (const item of highlightItems) {
      if (currentSec < item.start) {
        item.el.classList.remove('is-active', 'is-dimmed');
      } else if (item.el === activeItem.el) {
        // Active spotlight: full brightness, glow, contrast
        item.el.classList.remove('is-dimmed');
        item.el.classList.add('is-active');
      } else {
        // Earlier highlight on this slide: persistent muted marker
        item.el.classList.add('is-active', 'is-dimmed');
      }
    }
  }

  private fastForwardAllCues() {
    const slide = this.slides[this.currentIndex];
    if (slide?.cues) {
      for (const [cueId, cueVal] of Object.entries(slide.cues)) {
        const timing = getCueTiming(cueVal);
        this.triggeredCues.add(cueId);
        this.fastForwardElement(cueId, timing);
      }
    }
    // Also ensure all data-cue and highlight elements on this slide are active and un-dimmed in full/overview mode
    const slideEl = document.querySelector(`.reveal .slides section[data-slide-index="${this.currentIndex}"]`);
    if (slideEl) {
      slideEl.querySelectorAll<HTMLElement>('[data-cue], .cue-target, mark, .highlight-marker').forEach((el) => {
        el.classList.remove('is-dimmed', 'is-exited');
        el.classList.add('is-active', 'is-immediate');
      });
    }
    this.updateSlideIntroState();
  }

  private triggerAnimation(cueId: string, timing: { start: number; duration: number; end?: number }) {
    const el = this.getCueElement(cueId);
    if (!el) return;

    el.classList.remove('is-immediate');
    el.style.setProperty('--cue-duration', `${timing.duration}s`);

    const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
    if (isHighlight) {
      el.classList.remove('is-dimmed', 'is-exited');
      el.classList.add('is-active');
      this.updateHighlightSpotlight(timing.start);
    } else {
      this.updateStructuralSpotlight(timing.start);
      if (el.dataset.dim === 'false' || el.classList.contains('no-dim')) {
        el.classList.remove('is-dimmed', 'is-exited');
        el.classList.add('is-active');
      }
    }
  }

  private triggerExit(cueId: string) {
    const el = this.getCueElement(cueId);
    if (!el) return;

    const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
    // Words stay highlighted on the slide; structural cards default to dimmed unless explicitly marked for hiding
    if (!isHighlight) {
      if (el.dataset.exit === 'hide') {
        el.classList.remove('is-active', 'is-dimmed');
        el.classList.add('is-exited');
      } else {
        el.classList.remove('is-active');
        el.classList.add('is-dimmed');
      }
    }
  }

  private fastForwardElement(cueId: string, timing: { start: number; duration: number; end?: number }, currentSec?: number) {
    const el = this.getCueElement(cueId);
    if (!el) return;
    el.style.setProperty('--cue-duration', `${timing.duration}s`);

    if (cueId.endsWith('-speaker') || cueId === 'title-speaker') {
      if (currentSec === undefined || currentSec >= timing.start + 7.0) {
        el.classList.add('is-immediate');
      } else {
        el.classList.remove('is-immediate');
      }
    }

    const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
    if (!isHighlight && timing.end !== undefined && currentSec !== undefined && currentSec >= timing.end) {
      if (el.dataset.exit === 'hide') {
        el.classList.remove('is-active', 'is-dimmed');
        el.classList.add('is-exited');
      } else {
        el.classList.remove('is-active');
        el.classList.add('is-dimmed');
      }
    } else {
      el.classList.remove('is-dimmed', 'is-exited');
      el.classList.add('is-active');
    }
  }

  private resetElement(cueId: string) {
    const el = this.getCueElement(cueId);
    if (!el) return;
    el.classList.remove('is-active', 'is-dimmed', 'is-exited', 'is-immediate');
  }

  private notifyPlayState(state: boolean) {
    if (this.onPlayStateChangeCallback) {
      this.onPlayStateChangeCallback(state);
    }
  }

  public destroy() {
    this.stopTickLoop();
    Howler.stop();
    if (this.currentHowl) {
      this.currentHowl.off();
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
    if (this.nextHowl) {
      this.nextHowl.off();
      this.nextHowl.stop();
      this.nextHowl.unload();
      this.nextHowl = null;
    }
  }
}
