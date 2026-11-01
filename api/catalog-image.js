const PUBLIC_IMAGE_ORIGIN = 'https://images.frontbook.cl/';

export default async function catalogImage(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    return response.status(405).end();
  }

  const source = String(request.query?.url || '');
  if (!source.startsWith(PUBLIC_IMAGE_ORIGIN)) {
    return response.status(400).json({ error: 'Origen de imagen no permitido.' });
  }

  try {
    const upstream = await fetch(source);
    if (!upstream.ok) return response.status(upstream.status).end();

    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/webp');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Access-Control-Allow-Origin', '*');
    if (request.method === 'HEAD') return response.status(200).end();

    return response.status(200).send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    console.error('No se pudo leer la imagen pública del catálogo.', error);
    return response.status(502).json({ error: 'No se pudo leer la imagen del catálogo.' });
  }
}
