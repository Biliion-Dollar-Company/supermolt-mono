// User routes removed in v4 architecture.
// No local User model — user data lives in Ponzinomics.
// User-specific queries (agents, trades) are in /agents and /trades routes.
import { Hono } from 'hono';

const user = new Hono();

export { user };
