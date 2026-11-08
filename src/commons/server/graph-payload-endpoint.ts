import { getCollection } from 'astro:content';
import { getImage } from 'astro:assets';
import crypto from 'node:crypto';
import {
  buildCanonicalGraphPayload,
  type CanonicalGraphPayload,
} from '@commons/shared/graph-payload';

export interface GraphPayloadArtifact {
  payload: CanonicalGraphPayload;
  json: string;
  hash: string;
  url: string;
}

let cachedArtifactPromise: Promise<GraphPayloadArtifact> | null = null;

async function computeCanonicalGraphPayloadArtifact(): Promise<GraphPayloadArtifact> {
  const [
    posts,
    publications,
    presentations,
    projects,
    courses,
    services,
    visualizations,
    newsletters,
    tags,
  ] = await Promise.all([
    getCollection('posts'),
    getCollection('publications'),
    getCollection('presentations'),
    getCollection('projects'),
    getCollection('courses'),
    getCollection('services'),
    getCollection('visualizations'),
    getCollection('newsletters'),
    getCollection('tags'),
  ]);

  const payload = await buildCanonicalGraphPayload({
    posts,
    publications,
    presentations,
    projects,
    courses,
    services,
    visualizations,
    newsletters,
    tags,
    getImage,
  });

  const json = JSON.stringify(payload);
  const hash = crypto.createHash('md5').update(json).digest('hex').slice(0, 8);

  return {
    payload,
    json,
    hash,
    url: `/api/graph-payload-${hash}.json`,
  };
}

export async function getCanonicalGraphPayloadArtifact(): Promise<GraphPayloadArtifact> {
  if (import.meta.env.PROD) {
    if (!cachedArtifactPromise) {
      cachedArtifactPromise = computeCanonicalGraphPayloadArtifact();
    }
    return cachedArtifactPromise;
  }
  return computeCanonicalGraphPayloadArtifact();
}
