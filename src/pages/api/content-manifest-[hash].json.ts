import type { APIRoute, GetStaticPaths } from 'astro';
import { getContentManifestArtifact } from '@commons/server/content-manifest-endpoint';

export const getStaticPaths: GetStaticPaths = async () => {
  const { hash, json } = await getContentManifestArtifact();
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
