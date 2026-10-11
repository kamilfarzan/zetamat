const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle /log POST endpoint
    if (pathname === '/log' && req.method === 'POST') {
      try {
        const body = await req.json();
        console.log(`[LOG] Drill session received: score=${body.score ?? 'N/A'}, key=${body.key ?? 'N/A'}`);
      } catch {
        console.log('[LOG] Drill session received (non-JSON body)');
      }
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Static file mapping
    let filePath = '.' + pathname;
    if (pathname === '/' || pathname === '') {
      filePath = './index.html';
    } else if (pathname === '/game') {
      filePath = './game.html';
    } else if (pathname === '/stats') {
      filePath = './stats.html';
    }

    const file = Bun.file(filePath);
    if (await file.exists()) {
      return new Response(file);
    }

    return new Response('404 Not Found', { status: 404 });
  },
});

console.log(`Arithmetic Game dev server running at http://localhost:${PORT}`);
