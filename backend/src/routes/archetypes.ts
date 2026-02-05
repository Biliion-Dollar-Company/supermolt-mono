import { Hono } from 'hono';
import { getAllArchetypes, getArchetype } from '../lib/archetypes';

const archetypes = new Hono();

// GET /archetypes — list all archetypes (public, no auth needed)
archetypes.get('/', (c) => {
  return c.json({
    success: true,
    data: getAllArchetypes(),
  });
});

// GET /archetypes/:id — get single archetype (public)
archetypes.get('/:id', (c) => {
  const id = c.req.param('id');
  const archetype = getArchetype(id);

  if (!archetype) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: `Archetype '${id}' not found` } },
      404
    );
  }

  return c.json({ success: true, data: archetype });
});

export { archetypes };
