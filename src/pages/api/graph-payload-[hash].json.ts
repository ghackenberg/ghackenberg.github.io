import type { APIRoute, GetStaticPaths } from 'astro';
import { getCanonicalGraphPayloadArtifact } from '@commons/server/graph-payload-endpoint';

export const getStaticPaths: GetStaticPaths = async () => {
  const { hash, json } = await getCanonicalGraphPayloadArtifact();
  return [
    {
      params: { hash },
      props: { json },
    },
  ];
};

export const GET: APIRoute = ({ props }) => {
  const { json } = props as { json: string };
  return new Response(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
