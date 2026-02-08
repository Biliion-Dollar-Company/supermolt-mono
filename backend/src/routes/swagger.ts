/**
 * Swagger UI Route
 * 
 * Serves OpenAPI spec with Swagger UI for visual API exploration.
 * 
 * GET /api/swagger       → Swagger UI (HTML)
 * GET /api/openapi.yaml  → OpenAPI spec (YAML)
 * GET /api/openapi.json  → OpenAPI spec (JSON)
 */

import { Hono } from 'hono';
import { swaggerUI } from '@hono/swagger-ui';
import { readFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

export const swaggerRoutes = new Hono();

// Path to OpenAPI spec
const OPENAPI_PATH = join(import.meta.dir, '../../openapi.yaml');

/**
 * GET /api/swagger
 * Swagger UI for visual API exploration
 */
swaggerRoutes.get(
  '/',
  swaggerUI({
    url: '/api/openapi.yaml'
  })
);

/**
 * GET /api/openapi.yaml
 * OpenAPI specification in YAML format
 */
swaggerRoutes.get('/openapi.yaml', (c) => {
  try {
    const yaml = readFileSync(OPENAPI_PATH, 'utf-8');
    
    return c.text(yaml, 200, {
      'Content-Type': 'application/yaml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (error) {
    console.error('Failed to read openapi.yaml:', error);
    return c.text('# Error\n\nOpenAPI spec not found.', 404);
  }
});

/**
 * GET /api/openapi.json
 * OpenAPI specification in JSON format
 */
swaggerRoutes.get('/openapi.json', (c) => {
  try {
    const yamlContent = readFileSync(OPENAPI_PATH, 'utf-8');
    const json = YAML.parse(yamlContent);
    
    return c.json(json, 200, {
      'Cache-Control': 'public, max-age=3600'
    });
  } catch (error) {
    console.error('Failed to convert openapi.yaml to JSON:', error);
    return c.json({ error: 'Failed to load OpenAPI spec' }, 500);
  }
});
