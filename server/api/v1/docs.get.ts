// Nitro REST API Route: GET /api/v1/docs
// Serves interactive HTML Developer Documentation for Brand Muse API.

export default async function (event: any) {
  const res = event?.node?.res || event?.res;

  if (res && typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brand Muse — Developer REST API & Webhooks Reference</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=JetBrains+Mono:wght@400;500;600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0A0A0A;
      --card: #141414;
      --border: #262626;
      --accent: #8B1A1A;
      --text: #F4EFE6;
      --muted: #A3A3A3;
      --code-bg: #1C1C1C;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      line-height: 1.6;
      padding: 40px 20px;
    }
    .container { max-width: 900px; margin: 0 auto; }
    header { border-bottom: 1px solid var(--border); padding-bottom: 24px; margin-bottom: 40px; }
    .eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.22em; color: var(--accent); }
    h1 { font-family: 'Cormorant Garamond', serif; font-size: 42px; font-weight: 700; margin-top: 8px; }
    p.lead { color: var(--muted); font-size: 15px; margin-top: 8px; }
    .nav-links { display: flex; gap: 16px; margin-top: 16px; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .nav-links a { color: var(--muted); text-decoration: none; border-bottom: 1px dashed var(--muted); }
    .nav-links a:hover { color: var(--text); border-color: var(--text); }
    
    .section { margin-bottom: 48px; }
    h2 { font-family: 'Cormorant Garamond', serif; font-size: 26px; border-bottom: 1px solid var(--border); padding-bottom: 8px; margin-bottom: 20px; }
    
    .card { background: var(--card); border: 1px solid var(--border); padding: 24px; margin-bottom: 20px; }
    .badge { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; padding: 3px 8px; text-transform: uppercase; margin-right: 8px; }
    .badge-post { background: #1E3A8A; color: #93C5FD; }
    .badge-get { background: #064E3B; color: #6EE7B7; }
    
    .endpoint-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; font-family: 'JetBrains Mono', monospace; }
    .endpoint-url { font-size: 14px; font-weight: 600; }
    
    pre { background: var(--code-bg); border: 1px solid var(--border); padding: 14px; overflow-x: auto; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #E5E5E5; margin-top: 12px; }
    code { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #F59E0B; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
    th { font-family: 'JetBrains Mono', monospace; font-size: 11px; text-transform: uppercase; color: var(--muted); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="eyebrow">// DEVELOPER PLATFORM · REST &amp; WEBHOOKS</div>
      <h1>Brand Muse API Documentation</h1>
      <p class="lead">Programmatically trigger brand kit extractions, query structured design systems, embed live token stylesheets, and subscribe to webhook events.</p>
      <div class="nav-links">
        <a href="/api/v1/openapi.json" target="_blank">[ View OpenAPI 3.1.0 JSON ]</a>
        <a href="/settings">[ Manage API Keys &amp; Webhooks in Dashboard ]</a>
      </div>
    </header>

    <div class="section">
      <h2>Authentication &amp; Rate Limits</h2>
      <p style="color: var(--muted); font-size: 14px;">All requests require an API Key passed in the <code>Authorization</code> or <code>X-API-Key</code> header:</p>
      <pre>Authorization: Bearer bm_live_your_api_key_here</pre>
      <p style="color: var(--muted); font-size: 13px; margin-top: 12px;">Standard tier rate limit is <strong>60 requests / minute</strong> per key. Headers returned on every request:</p>
      <table>
        <tr><th>Header</th><th>Description</th></tr>
        <tr><td><code>X-RateLimit-Limit</code></td><td>Maximum requests permitted per 60-second window (60)</td></tr>
        <tr><td><code>X-RateLimit-Remaining</code></td><td>Remaining requests in current window</td></tr>
        <tr><td><code>X-RateLimit-Reset</code></td><td>Unix timestamp when current window resets</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>Endpoints Reference</h2>

      <!-- POST /api/v1/extract -->
      <div class="card">
        <div class="endpoint-header">
          <div>
            <span class="badge badge-post">POST</span>
            <span class="endpoint-url">/api/v1/extract</span>
          </div>
          <span style="font-size: 11px; color: var(--muted);">ASYNC EXTRACTION</span>
        </div>
        <p style="font-size: 13px; color: var(--muted);">Triggers asynchronous brand kit analysis from a website URL or document URL.</p>
        <pre>curl -X POST https://app.brandmuse.io/api/v1/extract \\
  -H "Authorization: Bearer bm_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://stripe.com"}'</pre>
        <p style="font-size: 12px; margin-top: 12px; color: var(--muted);">Response (HTTP 202 Accepted):</p>
        <pre>{
  "kit_id": "8f3b20df-4f05-4f40-84c1-cbfb49e3bf32",
  "status": "processing",
  "source_url": "https://stripe.com",
  "message": "Extraction initiated. Subscribe to webhooks or query GET /api/v1/kits/:id."
}</pre>
      </div>

      <!-- GET /api/v1/kits/:id -->
      <div class="card">
        <div class="endpoint-header">
          <div>
            <span class="badge badge-get">GET</span>
            <span class="endpoint-url">/api/v1/kits/:id</span>
          </div>
          <span style="font-size: 11px; color: var(--muted);">BRAND IDENTITY JSON</span>
        </div>
        <p style="font-size: 13px; color: var(--muted);">Retrieves the complete extracted design tokens, typography, colors, voice, and logos.</p>
        <pre>curl https://app.brandmuse.io/api/v1/kits/8f3b20df-4f05-4f40-84c1-cbfb49e3bf32 \\
  -H "Authorization: Bearer bm_live_..."</pre>
      </div>

      <!-- GET /api/v1/kits/:id/css -->
      <div class="card">
        <div class="endpoint-header">
          <div>
            <span class="badge badge-get">GET</span>
            <span class="endpoint-url">/api/v1/kits/:id/css</span>
          </div>
          <span style="font-size: 11px; color: var(--muted);">LIVE CDN STYLESHEET</span>
        </div>
        <p style="font-size: 13px; color: var(--muted);">Direct CSS custom properties stylesheet for live embedding on customer websites with automatic caching.</p>
        <pre>&lt;!-- Embed live tokens on any website --&gt;
&lt;link rel="stylesheet" href="https://app.brandmuse.io/api/v1/kits/8f3b20df-4f05-4f40-84c1-cbfb49e3bf32/css"&gt;</pre>
      </div>
    </div>

    <div class="section">
      <h2>Webhook Deliveries</h2>
      <p style="color: var(--muted); font-size: 14px;">Webhooks are delivered via HTTP POST with HMAC-SHA256 signature verification.</p>
      <table>
        <tr><th>Event</th><th>Trigger</th></tr>
        <tr><td><code>kit.extraction_completed</code></td><td>Extraction finished and brand kit is ready</td></tr>
        <tr><td><code>kit.tokens_updated</code></td><td>Colors, fonts, or tokens were modified</td></tr>
        <tr><td><code>kit.failed</code></td><td>Extraction failed or blocked by source site</td></tr>
      </table>
      <p style="color: var(--muted); font-size: 12px; margin-top: 14px;">Verify the signature using your webhook secret:</p>
      <pre>const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
const isValid = req.headers["x-brandmuse-signature"] === \`sha256=\${signature}\`;</pre>
    </div>
  </div>
</body>
</html>`;

  return html;
}
