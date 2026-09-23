// Nitro REST API Route: GET /api/v1/openapi.json
// Serves full OpenAPI 3.1.0 specification for the Brand Muse Developer REST API.

export default async function (event: any) {
  const res = event?.node?.res || event?.res;

  if (res && typeof res.setHeader === "function") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
  }

  const openApiSpec = {
    openapi: "3.1.0",
    info: {
      title: "Brand Muse Developer REST API",
      version: "1.0.0",
      description:
        "Public-facing Developer API and Webhooks for automated brand extraction, design token distribution, and headless theme embedding.",
      contact: {
        name: "Brand Muse Engineering",
        url: "https://brandmuse.io",
      },
    },
    servers: [
      {
        url: "/api/v1",
        description: "API v1 Endpoint Base",
      },
    ],
    security: [
      {
        BearerAuth: [],
      },
      {
        ApiKeyAuth: [],
      },
    ],
    paths: {
      "/extract": {
        post: {
          summary: "Trigger Asynchronous Brand Kit Extraction",
          description:
            "Accepts a website URL or document URL, triggers the AI brand ingestion pipeline, and returns the processing kit ID. Dispatches webhook events when completed.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    url: {
                      type: "string",
                      format: "uri",
                      description: "Target website URL to crawl and analyze",
                      example: "https://stripe.com",
                    },
                    document_url: {
                      type: "string",
                      format: "uri",
                      description: "Optional URL to brand guideline PDF or logo vector document",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "Extraction initiated successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      kit_id: { type: "string", format: "uuid" },
                      status: { type: "string", example: "processing" },
                      message: { type: "string" },
                      created_at: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
            "401": {
              description: "Missing or invalid API key",
            },
            "429": {
              description: "Rate limit exceeded (60 requests/min)",
            },
          },
        },
      },
      "/kits/{id}": {
        get: {
          summary: "Retrieve Complete Brand Identity",
          description:
            "Returns the complete extracted design system including colors, typography, DTCG tokens, voice guidelines, and logo assets.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Unique Brand Kit ID",
            },
            {
              name: "token",
              in: "query",
              required: false,
              schema: { type: "string" },
              description: "Optional share token for private kits",
            },
          ],
          responses: {
            "200": {
              description: "Full brand identity payload",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/BrandKitPayload",
                  },
                },
              },
            },
            "404": {
              description: "Brand kit not found",
            },
          },
        },
      },
      "/kits/{id}/css": {
        get: {
          summary: "Fetch Raw CSS Custom Properties Stylesheet",
          description:
            "Returns live `tokens.css` with `Content-Type: text/css` for direct CDN stylesheet embedding in HTML `<link>` tags.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Brand Kit ID",
            },
          ],
          responses: {
            "200": {
              description: "Raw compiled CSS stylesheet",
              content: {
                "text/css": {
                  schema: { type: "string" },
                },
              },
            },
          },
        },
      },
      "/kits/{id}/tokens": {
        get: {
          summary: "Fetch W3C DTCG & Figma Variables Tokens",
          description:
            "Returns W3C Design Tokens Community Group specification and Figma Variables JSON.",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string", format: "uuid" },
              description: "Brand Kit ID",
            },
          ],
          responses: {
            "200": {
              description: "Figma and DTCG tokens JSON",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "API Key (bm_live_...)",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
      schemas: {
        BrandKitPayload: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            status: { type: "string", example: "ready" },
            source_url: { type: "string", nullable: true },
            colors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  hex: { type: "string", example: "#8B1A1A" },
                  name: { type: "string", example: "Primary Crimson" },
                  role: { type: "string", example: "primary" },
                },
              },
            },
            fonts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  family: { type: "string", example: "Cormorant Garamond" },
                  role: { type: "string", example: "display" },
                  weights: { type: "array", items: { type: "string" } },
                },
              },
            },
            tokens: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  name: { type: "string" },
                  value: { type: "string" },
                },
              },
            },
            voice: {
              type: "object",
              nullable: true,
            },
            assets: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  kind: { type: "string" },
                  url: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };

  return openApiSpec;
}
