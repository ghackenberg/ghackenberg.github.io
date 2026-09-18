import { Howl } from 'howler';

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
  private exitedCues: Set<string> = new Set();
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
    this.exitedCues.clear();

    if (this.currentHowl) {
      this.currentHowl.stop();
      this.currentHowl.unload();
      this.currentHowl = null;
    }

    // Auto-bind slide cues (unassigned <mark> or boxes)
    this.bindSlideCues(index);

    const slide = this.slides[index];
    if (slide?.cues) {
      if (shouldPlay || this.isPlaying) {
        for (const cueId of Object.keys(slide.cues)) {
          this.resetElement(cueId);
        }
      } else {
        this.fastForwardAllCues();
      }
    }

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
      const current = this.currentHowl.seek();
      const currentSec = typeof current === 'number' ? current : 0;
      if (currentSec < 0.2) {
        const slide = this.slides[this.currentIndex];
        if (slide?.cues) {
          for (const cueId of Object.keys(slide.cues)) {
            this.resetElement(cueId);
          }
          this.triggeredCues.clear();
          this.exitedCues.clear();
        }
      }
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

      // Entrance animation (fade in)
      if (currentSec >= timing.start && !this.triggeredCues.has(cueId)) {
        this.triggeredCues.add(cueId);
        this.triggerAnimation(cueId, timing);
      }

      // Exit animation (fade out via {/cue} on boxes)
      if (timing.end !== undefined && currentSec >= timing.end && !this.exitedCues.has(cueId)) {
        this.exitedCues.add(cueId);
        this.triggerExit(cueId);
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
    // Also ensure all data-cue elements on this slide are active in non-playing mode
    const slideEl = document.querySelector(`.reveal .slides section[data-slide-index="${this.currentIndex}"]`);
    if (slideEl) {
      slideEl.querySelectorAll<HTMLElement>('[data-cue], .cue-target').forEach((el) => {
        el.classList.remove('is-dimmed', 'is-exited');
        el.classList.add('is-active');
      });
    }
  }

  private triggerAnimation(cueId: string, timing: { start: number; duration: number; end?: number }) {
    const el = this.getCueElement(cueId);
    if (!el) return;

    el.style.setProperty('--cue-duration', `${timing.duration}s`);
    el.classList.remove('is-dimmed', 'is-exited');
    el.classList.add('is-active');

    const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
    if (!isHighlight) {
      // Step down previous active cards on the same slide to dimmed spotlight
      const slideEl = document.querySelector(`.reveal .slides section[data-slide-index="${this.currentIndex}"]`);
      if (slideEl) {
        slideEl.querySelectorAll<HTMLElement>('[data-cue].is-active, .cue-target.is-active').forEach((activeEl) => {
          const isOtherHighlight = activeEl.tagName === 'MARK' || activeEl.classList.contains('highlight-marker');
          if (activeEl !== el && !activeEl.contains(el) && !el.contains(activeEl) && !isOtherHighlight) {
            activeEl.classList.add('is-dimmed');
          }
        });
      }
    }
  }

  private triggerExit(cueId: string) {
    const el = this.getCueElement(cueId);
    if (!el) return;

    const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
    // Words stay highlighted on the slide; only cards/boxes fade out on exit
    if (!isHighlight) {
      el.classList.remove('is-active', 'is-dimmed');
      el.classList.add('is-exited');
    }
  }

  private fastForwardElement(cueId: string, timing: { start: number; duration: number; end?: number }, currentSec?: number) {
    const el = this.getCueElement(cueId);
    if (!el) return;
    el.style.setProperty('--cue-duration', `${timing.duration}s`);

    const isHighlight = el.tagName === 'MARK' || el.classList.contains('highlight-marker');
    if (!isHighlight && timing.end !== undefined && currentSec !== undefined && currentSec >= timing.end) {
      el.classList.remove('is-active', 'is-dimmed');
      el.classList.add('is-exited');
    } else {
      el.classList.remove('is-dimmed', 'is-exited');
      el.classList.add('is-active');
    }
  }

  private resetElement(cueId: string) {
    const el = this.getCueElement(cueId);
    if (!el) return;
    el.classList.remove('is-active', 'is-dimmed', 'is-exited');
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
