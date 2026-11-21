interface Env {
  DB: D1Database;
  ALLOWED_ORIGIN?: string;
}

interface PriorityQueueItem {
  wordId: string;
  queuedAt: string;
}

interface AssignedWord {
  wordId: string;
  batchNumber: number;
  dayNumber: number;
  assignedDate: string;
  sourceType: 'AUTO' | 'CUSTOM';
  masteryScore: 0 | 1 | 2;
  remedialCount: number;
  lastTestedAt: string | null;
  pronunciationScore: number;
  pronunciationAttempts: number;
  updatedAt: string;
}

interface QuizHistoryItem {
  clientId: string;
  batchNumber: number;
  quizType: 'BATCH' | 'REMEDIAL' | 'CUMULATIVE';
  completedAt: string;
  totalQuestions: number;
  totalCorrect: number;
  details: unknown[];
}

interface SyncRequestBody {
  priorityQueue?: PriorityQueueItem[];
  assignedWords?: AssignedWord[];
  quizHistory?: QuizHistoryItem[];
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function jsonResponse(data: unknown, env: Env, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(env)
    }
  });
}

async function fetchSyncSnapshot(db: D1Database, syncKey: string) {
  const [queueRes, assignedRes, historyRes] = await Promise.all([
    db
      .prepare('SELECT word_id, queued_at FROM priority_queue WHERE sync_key = ? ORDER BY queued_at ASC')
      .bind(syncKey)
      .all<{ word_id: string; queued_at: string }>(),
    db
      .prepare(
        `SELECT word_id, batch_number, day_number, assigned_date, source_type,
                mastery_score, remedial_count, last_tested_at, pronunciation_score,
                pronunciation_attempts, updated_at
         FROM assigned_words WHERE sync_key = ?`
      )
      .bind(syncKey)
      .all<{
        word_id: string;
        batch_number: number;
        day_number: number;
        assigned_date: string;
        source_type: 'AUTO' | 'CUSTOM';
        mastery_score: 0 | 1 | 2;
        remedial_count: number;
        last_tested_at: string | null;
        pronunciation_score: number;
        pronunciation_attempts: number;
        updated_at: string;
      }>(),
    db
      .prepare(
        `SELECT client_id, batch_number, quiz_type, completed_at, total_questions, total_correct, details_json
         FROM quiz_history WHERE sync_key = ? ORDER BY completed_at DESC LIMIT 200`
      )
      .bind(syncKey)
      .all<{
        client_id: string;
        batch_number: number;
        quiz_type: 'BATCH' | 'REMEDIAL' | 'CUMULATIVE';
        completed_at: string;
        total_questions: number;
        total_correct: number;
        details_json: string;
      }>()
  ]);

  return {
    serverTime: new Date().toISOString(),
    priorityQueue: (queueRes.results || []).map((r) => ({
      wordId: r.word_id,
      queuedAt: r.queued_at
    })),
    assignedWords: (assignedRes.results || []).map((r) => ({
      wordId: r.word_id,
      batchNumber: r.batch_number,
      dayNumber: r.day_number,
      assignedDate: r.assigned_date,
      sourceType: r.source_type,
      masteryScore: r.mastery_score,
      remedialCount: r.remedial_count,
      lastTestedAt: r.last_tested_at,
      pronunciationScore: r.pronunciation_score,
      pronunciationAttempts: r.pronunciation_attempts,
      updatedAt: r.updated_at
    })),
    quizHistory: (historyRes.results || []).map((r) => ({
      clientId: r.client_id,
      batchNumber: r.batch_number,
      quizType: r.quiz_type,
      completedAt: r.completed_at,
      totalQuestions: r.total_questions,
      totalCorrect: r.total_correct,
      details: JSON.parse(r.details_json || '[]')
    }))
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, service: 'vocket-api' }, env);
    }

    const match = url.pathname.match(/^\/api\/sync\/([A-Za-z0-9_-]{4,64})$/);
    if (!match) {
      return jsonResponse({ error: 'Endpoint tidak ditemukan' }, env, 404);
    }

    const syncKey = match[1].toUpperCase();

    if (request.method === 'GET') {
      const snapshot = await fetchSyncSnapshot(env.DB, syncKey);
      return jsonResponse(snapshot, env);
    }

    if (request.method === 'POST') {
      let body: SyncRequestBody;
      try {
        body = (await request.json()) as SyncRequestBody;
      } catch {
        return jsonResponse({ error: 'Body JSON tidak valid' }, env, 400);
      }

      const statements: D1PreparedStatement[] = [];

      for (const a of body.assignedWords || []) {
        statements.push(
          env.DB.prepare(
            `INSERT INTO assigned_words (
               sync_key, word_id, batch_number, day_number, assigned_date, source_type,
               mastery_score, remedial_count, last_tested_at, pronunciation_score,
               pronunciation_attempts, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(sync_key, word_id) DO UPDATE SET
               mastery_score = CASE WHEN excluded.updated_at >= assigned_words.updated_at THEN excluded.mastery_score ELSE assigned_words.mastery_score END,
               remedial_count = MAX(assigned_words.remedial_count, excluded.remedial_count),
               last_tested_at = COALESCE(excluded.last_tested_at, assigned_words.last_tested_at),
               pronunciation_score = MAX(assigned_words.pronunciation_score, excluded.pronunciation_score),
               pronunciation_attempts = MAX(assigned_words.pronunciation_attempts, excluded.pronunciation_attempts),
               updated_at = MAX(assigned_words.updated_at, excluded.updated_at)`
          ).bind(
            syncKey,
            a.wordId,
            a.batchNumber,
            a.dayNumber,
            a.assignedDate,
            a.sourceType,
            a.masteryScore,
            a.remedialCount,
            a.lastTestedAt,
            a.pronunciationScore,
            a.pronunciationAttempts,
            a.updatedAt || new Date().toISOString()
          )
        );
      }

      for (const q of body.priorityQueue || []) {
        statements.push(
          env.DB.prepare(
            `INSERT OR IGNORE INTO priority_queue (sync_key, word_id, queued_at) VALUES (?, ?, ?)`
          ).bind(syncKey, q.wordId, q.queuedAt)
        );
      }

      for (const h of body.quizHistory || []) {
        statements.push(
          env.DB.prepare(
            `INSERT OR IGNORE INTO quiz_history (
               sync_key, client_id, batch_number, quiz_type, completed_at,
               total_questions, total_correct, details_json
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            syncKey,
            h.clientId,
            h.batchNumber,
            h.quizType,
            h.completedAt,
            h.totalQuestions,
            h.totalCorrect,
            JSON.stringify(h.details || [])
          )
        );
      }

      // Eksekusi batch per 80 statement agar aman terhadap limit D1
      const batchSize = 80;
      for (let i = 0; i < statements.length; i += batchSize) {
        await env.DB.batch(statements.slice(i, i + batchSize));
      }

      // Hapus item priority_queue yang sudah masuk assigned_words
      await env.DB.prepare(
        `DELETE FROM priority_queue
         WHERE sync_key = ? AND word_id IN (SELECT word_id FROM assigned_words WHERE sync_key = ?)`
      )
        .bind(syncKey, syncKey)
        .run();

      const snapshot = await fetchSyncSnapshot(env.DB, syncKey);
      return jsonResponse(snapshot, env);
    }

    return jsonResponse({ error: 'Method tidak didukung' }, env, 405);
  }
};
