import { Howl } from 'howler';
import { animate } from 'motion';

export interface SlideCueMap {
  [cueId: string]: number; // timestamp in seconds
}

export interface SlideData {
  id: string;
  audioUrl?: string;
  cues?: SlideCueMap;
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
      html5: true, // stream audio
      rate: this.playbackRate,
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
      html5: true,
      preload: true
    });
  }

  public play() {
    if (this.currentHowl) {
      this.currentHowl.play();
    } else {
      const slide = this.slides[this.currentIndex];
      if (slide?.audioUrl) {
        this.loadSlideAudio(slide, true);
      }
    }
  }

  public pause() {
    if (this.currentHowl) {
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

  public setRate(rate: number) {
    this.playbackRate = rate;
    if (this.currentHowl) {
      this.currentHowl.rate(rate);
    }
  }

  public seek(seconds: number) {
    if (this.currentHowl) {
      this.currentHowl.seek(seconds);
      this.syncCuesToTime(seconds);
    }
  }

  private startTickLoop() {
    this.stopTickLoop();
    const tick = () => {
      if (this.currentHowl && this.isPlaying) {
        const currentSec = (this.currentHowl.seek() as number) || 0;
        const totalSec = this.currentHowl.duration() || 0;

        this.checkCues(currentSec);

        if (this.onProgressCallback) {
          this.onProgressCallback(currentSec, totalSec);
        }
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

    for (const [cueId, timestamp] of Object.entries(slide.cues)) {
      if (currentSec >= timestamp && !this.triggeredCues.has(cueId)) {
        this.triggeredCues.add(cueId);
        this.triggerAnimation(cueId);
      }
    }
  }

  private syncCuesToTime(currentSec: number) {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;

    for (const [cueId, timestamp] of Object.entries(slide.cues)) {
      if (currentSec >= timestamp) {
        this.triggeredCues.add(cueId);
        this.fastForwardElement(cueId);
      } else {
        this.triggeredCues.delete(cueId);
        this.resetElement(cueId);
      }
    }
  }

  private fastForwardAllCues() {
    const slide = this.slides[this.currentIndex];
    if (!slide?.cues) return;
    for (const cueId of Object.keys(slide.cues)) {
      this.triggeredCues.add(cueId);
      this.fastForwardElement(cueId);
    }
  }

  private triggerAnimation(cueId: string) {
    const el = document.getElementById(cueId);
    if (!el) return;

    // Smooth entry animation for target element
    animate(
      el,
      {
        opacity: [0, 1],
        scale: [0.96, 1],
        y: [12, 0]
      },
      {
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1]
      }
    );

    // If element contains vector paths, animate line drawing
    const paths = el.querySelectorAll('path.graph-edge-path');
    if (paths.length > 0) {
      animate(paths, { pathLength: [0, 1] }, { duration: 0.8, ease: 'easeOut' });
    }
  }

  private fastForwardElement(cueId: string) {
    const el = document.getElementById(cueId);
    if (!el) return;
    el.style.opacity = '1';
    el.style.transform = 'none';
  }

  private resetElement(cueId: string) {
    const el = document.getElementById(cueId);
    if (!el) return;
    el.style.opacity = '0.15';
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
