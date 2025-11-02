export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }) {
    // serve static asset if it exists
    let res = await env.ASSETS.fetch(request);

    // SPA fallback: on 404, return /index.html so client-side router works
    if (res.status === 404 && request.method === "GET") {
      const url = new URL(request.url);
      const indexReq = new Request(url.origin + "/index.html", request);
      res = await env.ASSETS.fetch(indexReq);
    }

    return res;
  }
} satisfies ExportedHandler;
