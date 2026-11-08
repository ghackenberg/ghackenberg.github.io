import type { APIRoute, GetStaticPaths } from 'astro';
import {
  VISUALIZATION_ENGINES,
  getGraphLayoutBundle,
} from '@commons/server/graph-layout-endpoint';
import type { VisualizationEngineType } from '@commons/shared/graph-payload';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const bundles = await Promise.all(
    VISUALIZATION_ENGINES.map((engine) => getGraphLayoutBundle(engine))
  );
  return bundles.map((bundle) => ({
    params: { slug: bundle.slug },
    props: { engine: bundle.engine, json: bundle.json },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { engine, json } = props as { engine: VisualizationEngineType; json?: string };
  const body = json ?? (await getGraphLayoutBundle(engine)).json;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
