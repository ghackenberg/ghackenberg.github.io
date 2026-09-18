import { Howl } from 'howler';
import { animate } from 'motion';

export type CueTiming = number | { start: number; duration?: number; end?: number };

export interface SlideCueMap {
  [cueId: string]: CueTiming;
}

export interface SlideData {
  id: string;
  audioUrl?: string;
  cues?: SlideCueMap;
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
  private currentHowl: Howl | null = null;
  private nextHowl: Howl | null = null;
  private isPlaying: boolean = false;
  private playbackRate: number = 1.0;
  private triggeredCues: Set<string> = new Set();
  private rafId: number | null = null;
  private onSlideChangeCallback?: (index: number) => void;
  private onProgressCallback?: (currentSec: number, totalSec: number) => void;
  private onPlayStateChangeCallback?: (isPlaying: boolean) => void;

  constructor(
    slides: SlideData[],
    options?: {
      onSlideChange?: (index: number) => void;
      onProgress?: (currentSec: number, totalSec: number) => void;
      onPlayStateChange?: (isPlaying: boolean) => void;
    }
  ) {
    this.slides = slides;
    this.onSlideChangeCallback = options?.onSlideChange;
    this.onProgressCallback = options?.onProgress;
    this.onPlayStateChangeCallback = options?.onPlayStateChange;
  }

  public setSlideIndex(index: number, shouldPlay: boolean = false) {
    if (index < 0 || index >= this.slides.length) return;
    this.currentIndex = index;
    this.triggeredCues.clear();

    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }

    const slide = this.slides[index];
    if (slide?.audioUrl) {
      this.loadSlideAudio(slide, shouldPlay || this.isPlaying);
      this.preloadNextSlideAudio(index + 1);
    }

    if (this.onSlideChangeCallback) {
      this.onSlideChangeCallback(index);
    }
  }

  private loadSlideAudio(slide: SlideData, autoPlay: boolean) {
    if (!slide.audioUrl) return;

    this.currentHowl = new Howl({
      src: [slide.audioUrl],
      html5: false, // Use Web Audio API for exact duration & timing without streaming bugs
      rate: this.playbackRate,
      onload: () => {
        const total = this.currentHowl?.duration();
        const totalSec = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;
        if (this.onProgressCallback) {
          const current = this.currentHowl?.seek();
          const currentSec = (typeof current === 'number' && Number.isFinite(current)) ? current : 0;
          this.onProgressCallback(currentSec, totalSec);
        }
      },
      onplay: () => {
        this.isPlaying = true;
        this.notifyPlayState(true);
        this.startTickLoop();
      },
      onpause: () => {
        this.isPlaying = false;
        this.notifyPlayState(false);
        this.stopTickLoop();
      },
      onstop: () => {
        this.isPlaying = false;
        this.notifyPlayState(false);
        this.stopTickLoop();
      },
      onend: () => {
        this.stopTickLoop();
        // Trigger all remaining cues so the slide ends in completed state
        this.fastForwardAllCues();
        // Advance to next slide automatically if we were playing
        if (this.currentIndex < this.slides.length - 1) {
          this.setSlideIndex(this.currentIndex + 1, true);
        } else {
          this.isPlaying = false;
          this.notifyPlayState(false);
        }
      }
    });

    if (autoPlay) {
      this.currentHowl.play();
    }
  }

  private preloadNextSlideAudio(nextIndex: number) {
    if (nextIndex >= this.slides.length) return;
    const nextSlide = this.slides[nextIndex];
    if (!nextSlide?.audioUrl) return;

    if (this.nextHowl) {
      this.nextHowl.unload();
    }

    this.nextHowl = new Howl({
      src: [nextSlide.audioUrl],
      html5: false,
      preload: true
    });
  }

  public play() {
    if (this.currentHowl && !this.currentHowl.playing()) {
      this.currentHowl.play();
    } else if (!this.currentHowl) {
      this.setSlideIndex(this.currentIndex, true);
    }
  }

  public pause() {
    if (this.currentHowl && this.currentHowl.playing()) {
      this.currentHowl.pause();
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
    if (this.currentHowl) {
      this.currentHowl.seek(targetSec);
      this.syncCuesToTime(targetSec);
      if (this.onProgressCallback) {
        const total = this.currentHowl.duration();
        const totalSec = (typeof total === 'number' && Number.isFinite(total) && total > 0) ? total : 0;
        this.onProgressCallback(targetSec, totalSec);
      }
    }
  }

  public setRate(rate: number) {
    this.playbackRate = rate;
    if (this.currentHowl) {
      this.currentHowl.rate(rate);
    }
  }

  private startTickLoop() {
    this.stopTickLoop();

    const tick = () => {
      if (this.currentHowl && this.currentHowl.playing()) {
        const current = this.currentHowl.seek();
        const currentSec = (typeof current === 'number' && Number.isFinite(current)) ? current : 0;
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
      if (currentSec >= timing.start && !this.triggeredCues.has(cueId)) {
        this.triggeredCues.add(cueId);
        this.triggerAnimation(cueId, timing);
      }
    }
  }

  private syncCuesToTime(currentSec: number) {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;

    for (const [cueId, cueVal] of Object.entries(slide.cues)) {
      const timing = getCueTiming(cueVal);
      if (currentSec >= timing.start) {
        this.triggeredCues.add(cueId);
        this.fastForwardElement(cueId, timing, currentSec);
      } else {
        this.triggeredCues.delete(cueId);
        this.resetElement(cueId);
      }
    }
  }

  private fastForwardAllCues() {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;
    for (const [cueId, cueVal] of Object.entries(slide.cues)) {
      const timing = getCueTiming(cueVal);
      this.triggeredCues.add(cueId);
      this.fastForwardElement(cueId, timing);
    }
  }

  private triggerAnimation(cueId: string, timing: { start: number; duration: number; end?: number }) {
    const el = document.getElementById(cueId);
    if (!el) return;

    el.style.setProperty('--cue-duration', `${timing.duration}s`);
    el.classList.add('is-active');
    el.classList.remove('is-dimmed');

    // Smooth entry animation for non-inline target elements
    const isHighlight = el.classList.contains('highlight-marker');
    if (!isHighlight) {
      animate(
        el,
        {
          opacity: [0, 1],
          scale: [0.96, 1],
          y: [12, 0]
        },
        {
          duration: Math.min(timing.duration, 0.6),
          ease: [0.16, 1, 0.3, 1]
        }
      );
    }

    // If element contains vector paths, animate line drawing
    const paths = el.querySelectorAll('path.graph-edge-path');
    if (paths.length > 0) {
      animate(paths, { pathLength: [0, 1] }, { duration: 0.8, ease: 'easeOut' });
    }
  }

  private fastForwardElement(cueId: string, timing: { start: number; duration: number; end?: number }, currentSec?: number) {
    const el = document.getElementById(cueId);
    if (!el) return;
    el.style.setProperty('--cue-duration', `${timing.duration}s`);
    el.classList.add('is-active');

    const isHighlight = el.classList.contains('highlight-marker');
    if (timing.end !== undefined && currentSec !== undefined && currentSec > timing.end) {
      if (!isHighlight) {
        el.classList.add('is-dimmed');
        el.classList.remove('is-active');
      }
    } else {
      el.classList.remove('is-dimmed');
    }

    if (!isHighlight) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    }
  }

  private resetElement(cueId: string) {
    const el = document.getElementById(cueId);
    if (!el) return;
    el.classList.remove('is-active', 'is-dimmed');
    if (!el.classList.contains('highlight-marker')) {
      el.style.opacity = '0.2';
    }
  }

  private notifyPlayState(state: boolean) {
    if (this.onPlayStateChangeCallback) {
      this.onPlayStateChangeCallback(state);
    }
  }

  public destroy() {
    this.stopTickLoop();
    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }
    if (this.nextHowl) {
      this.nextHowl.unload();
      this.nextHowl = null;
    }
  }
}
