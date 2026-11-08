/// <reference types="astro/client" />

declare module 'eslint-plugin-eslint-comments';
declare module 'graphology-layout-forceatlas2';
declare module '3d-force-graph';

declare module 'd3-force-3d' {
  export interface SimNode3D {
    id: string;
    x: number;
    y: number;
    z: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
    val?: number;
    index?: number;
  }

  export interface SimLink3D {
    source: string | SimNode3D;
    target: string | SimNode3D;
    index?: number;
  }

  export interface ForceLink3D {
    id(accessor: (node: SimNode3D) => string): ForceLink3D;
    distance(dist: number | ((link: SimLink3D) => number)): ForceLink3D;
    strength(str: number | ((link: SimLink3D) => number)): ForceLink3D;
  }

  export interface ForceManyBody3D {
    strength(str: number | ((node: SimNode3D) => number)): ForceManyBody3D;
    distanceMax(dist: number): ForceManyBody3D;
  }

  export interface ForceCenter3D {
    strength(str: number): ForceCenter3D;
  }

  export interface ForceCollide3D {
    radius(rad: number | ((node: SimNode3D) => number)): ForceCollide3D;
    strength(str: number): ForceCollide3D;
    iterations(iter: number): ForceCollide3D;
  }

  export interface Simulation3D {
    force(name: string, forceInstance: ForceLink3D | ForceManyBody3D | ForceCenter3D | ForceCollide3D | null): Simulation3D;
    alphaDecay(decay: number): Simulation3D;
    stop(): Simulation3D;
    tick(iterations?: number): Simulation3D;
    nodes(): SimNode3D[];
  }

  export function forceSimulation(nodes?: SimNode3D[], numDimensions?: number): Simulation3D;
  export function forceLink(links?: SimLink3D[]): ForceLink3D;
  export function forceManyBody(): ForceManyBody3D;
  export function forceCenter(x?: number, y?: number, z?: number): ForceCenter3D;
  export function forceCollide(radius?: number | ((node: SimNode3D) => number)): ForceCollide3D;
}
