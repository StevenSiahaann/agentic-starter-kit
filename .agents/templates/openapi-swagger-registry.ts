/**
 * OpenAPI 3.1 Contract Registry & Interactive Swagger UI / Scalar Docs Template
 * Implements: Code-first OpenAPI 3.1 JSON generation (/api/openapi.json),
 * Interactive Swagger UI HTML endpoint (/api/docs), BearerAuth & Idempotency-Key schemes,
 * and standard RFC 7807 Problem Details response components.
 */

export interface OpenApiRouteSchema {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  path: string;
  operationId: string;
  summary: string;
  tags: string[];
  requiresAuth?: boolean;
  requiresIdempotencyKey?: boolean;
  requestBodySchema?: Record<string, unknown>;
  responseDataSchema: Record<string, unknown>;
  successStatusCode?: 200 | 201 | 202;
}

export class OpenApiContractRegistry {
  private readonly routes: OpenApiRouteSchema[] = [];

  constructor(
    private readonly serviceTitle: string,
    private readonly version = '1.0.0',
    private readonly serverUrl = '/api/v1'
  ) {}

  public registerRoute(route: OpenApiRouteSchema): this {
    this.routes.push(route);
    return this;
  }

  /**
   * Generates the complete OpenAPI 3.1.0 specification object for GET /api/openapi.json
   */
  public generateSpec(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};

    for (const route of this.routes) {
      if (!paths[route.path]) {
        paths[route.path] = {};
      }

      const parameters: Array<Record<string, unknown>> = [];
      if (route.requiresIdempotencyKey) {
        parameters.push({ $ref: '#/components/parameters/IdempotencyKeyHeader' });
      }

      const successCode = String(route.successStatusCode ?? 200);

      paths[route.path][route.method] = {
        operationId: route.operationId,
        summary: route.summary,
        tags: route.tags,
        security: route.requiresAuth !== false ? [{ BearerAuth: [] }] : [],
        parameters,
        ...(route.requestBodySchema
          ? {
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: route.requestBodySchema,
                  },
                },
              },
            }
          : {}),
        responses: {
          [successCode]: {
            description: 'Successful operation',
            headers: {
              'X-Trace-Id': {
                schema: { type: 'string' },
                description: 'W3C distributed trace correlation ID',
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['data', 'meta'],
                  properties: {
                    data: route.responseDataSchema,
                    meta: { $ref: '#/components/schemas/ResponseMeta' },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/ProblemBadRequest' },
          '401': { $ref: '#/components/responses/ProblemUnauthorized' },
          '409': { $ref: '#/components/responses/ProblemConflict' },
          '422': { $ref: '#/components/responses/ProblemUnprocessable' },
          '429': { $ref: '#/components/responses/ProblemRateLimited' },
          '500': { $ref: '#/components/responses/ProblemInternalError' },
        },
      };
    }

    return {
      openapi: '3.1.0',
      info: {
        title: this.serviceTitle,
        version: this.version,
        description: 'Auto-generated Enterprise OpenAPI 3.1 Contract Specification',
      },
      servers: [{ url: this.serverUrl }],
      paths,
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        parameters: {
          IdempotencyKeyHeader: {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            description: 'Unique UUIDv4/UUIDv7 key for safe idempotent mutation replay',
            schema: { type: 'string', format: 'uuid' },
          },
        },
        schemas: {
          ResponseMeta: {
            type: 'object',
            required: ['trace_id'],
            properties: {
              trace_id: { type: 'string', example: '4bf92f3577b34da6a3ce929d0e0e4736' },
              next_cursor: { type: 'string', nullable: true },
              has_more: { type: 'boolean' },
            },
          },
          ProblemDetails: {
            type: 'object',
            description: 'RFC 7807 Standard Problem Details Error Envelope',
            required: ['type', 'title', 'status', 'detail', 'code', 'trace_id', 'timestamp'],
            properties: {
              type: { type: 'string', format: 'uri' },
              title: { type: 'string' },
              status: { type: 'integer' },
              detail: { type: 'string' },
              code: { type: 'string' },
              trace_id: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
        responses: {
          ProblemBadRequest: {
            description: 'Bad Request (400)',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          ProblemUnauthorized: {
            description: 'Unauthorized (401)',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          ProblemConflict: {
            description: 'Business State or Idempotency Conflict (409)',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          ProblemUnprocessable: {
            description: 'Validation or Domain Invariant Failure (422)',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          ProblemRateLimited: {
            description: 'Rate Limit Exceeded (429)',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          ProblemInternalError: {
            description: 'Masked Internal Server Error (500)',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
        },
      },
    };
  }

  /**
   * Renders interactive Swagger UI HTML pointing to /api/openapi.json (for GET /api/docs)
   */
  public renderSwaggerUiHtml(openApiJsonPath = '/api/openapi.json'): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.serviceTitle} — OpenAPI 3.1 Swagger Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body style="margin:0; background:#0B0F19;">
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${openApiJsonPath}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;
  }
}
