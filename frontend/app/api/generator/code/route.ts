export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const endpoints = [
  '/api/generator/code/generate',
  '/api/generator/code/generate-challenge',
  '/api/generator/code/submit-challenge',
  '/api/generator/code/interactive-debug',
];

export async function GET() {
  return Response.json({
    ok: true,
    service: 'generator-code-api',
    status: 'ready',
    endpoints,
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}