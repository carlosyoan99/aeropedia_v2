// Cloudflare Worker — SPA fallback
// Serves index.html for all navigation requests (SPA routing)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Serve static assets directly
    const isAsset = /\.(?:js|css|json|png|webp|svg|ico|woff2?|ttf|txt|webmanifest)$/.test(url.pathname);
    
    try {
      const response = await env.ASSETS.fetch(request);
      if (response.ok || isAsset) return response;
    } catch {}
    
    // SPA fallback: serve index.html for all other routes
    const indexRequest = new Request(new URL('/index.html', url.origin), request);
    try {
      return await env.ASSETS.fetch(indexRequest);
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  }
};
