import Fastify from 'fastify';
import cors from '@fastify/cors';
import Database from 'better-sqlite3';
import { simpleGit } from 'simple-git';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });
await fastify.register(cors, { origin: '*' });

// SQLite Setup
const db = new Database('chartdb_cloud.db');
db.exec(`
  CREATE TABLE IF NOT EXISTS models (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    json_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_diagram_id TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS diagram_filters (
    diagram_id TEXT PRIMARY KEY,
    table_ids TEXT,
    schema_ids TEXT
  );
`);

// ... (schemas anteriores) ...

// Novos Endpoints para Configuração
fastify.get('/api/config', async () => {
  const config = db.prepare('SELECT * FROM config WHERE id = 1').get();
  return config || { default_diagram_id: '' };
});

fastify.post('/api/config', async (request) => {
  const { defaultDiagramId } = request.body;
  db.prepare('INSERT INTO config (id, default_diagram_id) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET default_diagram_id = ?, updated_at = CURRENT_TIMESTAMP')
    .run(defaultDiagramId, defaultDiagramId);
  return { success: true };
});

// Novos Endpoints para Filtros
fastify.get('/api/filters/:diagramId', async (request) => {
  const filter = db.prepare('SELECT * FROM diagram_filters WHERE diagram_id = ?').get(request.params.diagramId);
  if (!filter) return { tableIds: [], schemasIds: [] };
  return {
    tableIds: JSON.parse(filter.table_ids || '[]'),
    schemasIds: JSON.parse(filter.schema_ids || '[]')
  };
});

fastify.post('/api/filters/:diagramId', async (request) => {
  const { tableIds, schemasIds } = request.body;
  db.prepare('INSERT INTO diagram_filters (diagram_id, table_ids, schema_ids) VALUES (?, ?, ?) ON CONFLICT(diagram_id) DO UPDATE SET table_ids = ?, schema_ids = ?')
    .run(request.params.diagramId, JSON.stringify(tableIds), JSON.stringify(schemasIds), JSON.stringify(tableIds), JSON.stringify(schemasIds));
  return { success: true };
});

// Endpoint para Deletar Diagrama (e seus filtros)
fastify.delete('/api/models/:id', async (request) => {
  db.prepare('DELETE FROM models WHERE id = ?').run(request.params.id);
  db.prepare('DELETE FROM diagram_filters WHERE diagram_id = ?').run(request.params.id);
  return { success: true };
});

// Zod Schemas
const modelSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  json_data: z.record(z.any())
});

const gitPushSchema = z.object({
  repoUrl: z.string(),
  username: z.string(),
  token: z.string(),
  commitMsg: z.string(),
  jsonData: z.record(z.any()),
  fileName: z.string().default('model.json')
});

// Endpoints: Local Cloud (SQLite)
fastify.get('/api/models', async () => {
  return db.prepare('SELECT id, name, created_at, updated_at FROM models ORDER BY updated_at DESC').all();
});

fastify.get('/api/models/:id', async (request, reply) => {
  const model = db.prepare('SELECT * FROM models WHERE id = ?').get(request.params.id);
  if (!model) return reply.code(404).send({ error: 'Model not found' });
  return { ...model, json_data: JSON.parse(model.json_data) };
});

fastify.post('/api/models', async (request) => {
  const { id = nanoid(), name, json_data } = modelSchema.parse(request.body);
  const jsonStr = JSON.stringify(json_data);
  
  const existing = db.prepare('SELECT id FROM models WHERE id = ?').get(id);
  if (existing) {
    db.prepare('UPDATE models SET name = ?, json_data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(name, jsonStr, id);
  } else {
    db.prepare('INSERT INTO models (id, name, json_data) VALUES (?, ?, ?)')
      .run(id, name, jsonStr);
  }
  return { id, name };
});

// Endpoint: Git Integration
fastify.post('/api/git/push', async (request, reply) => {
  const { repoUrl, username, token, commitMsg, jsonData, fileName } = gitPushSchema.parse(request.body);
  const tempDir = path.join(__dirname, 'temp', nanoid());
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    // Auth URL: https://user:token@github.com/repo.git
    const authUrl = repoUrl.replace('https://', `https://${username}:${token}@`);
    
    const git = simpleGit(tempDir);
    await git.clone(authUrl, '.', ['--depth', '1']);
    
    await fs.writeFile(path.join(tempDir, fileName), JSON.stringify(jsonData, null, 2));
    
    await git.add(fileName);
    await git.addConfig('user.name', username);
    await git.addConfig('user.email', `${username}@chartdb-cloud.local`);
    
    await git.commit(commitMsg);
    await git.push('origin', 'main'); // O usuário pode querer configurar a branch
    
    return { success: true, message: 'Push successful' };
  } catch (error) {
    fastify.log.error(error);
    return reply.code(500).send({ error: error.message });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

const start = async () => {
  try {
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
