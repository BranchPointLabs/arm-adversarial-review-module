use rusqlite::Connection;

pub fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
  conn.execute_batch(
    r#"
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_notes (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      text TEXT NOT NULL,
      tags TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      text TEXT NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('IDEA', 'PRD', 'PLAN', 'diagram', 'json')),
      markdown TEXT NOT NULL,
      diagram_entities TEXT NOT NULL DEFAULT '[]',
      mermaid TEXT NOT NULL DEFAULT 'flowchart LR',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_references (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      reference_type TEXT NOT NULL DEFAULT 'file',
      file_name TEXT NOT NULL,
      file_path TEXT,
      extracted_text TEXT,
      summary TEXT,
      source_url TEXT,
      is_selected INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      agent TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_cards (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      run_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      proposed_update TEXT,
      target_section TEXT,
      source_agent TEXT,
      source_document_title TEXT,
      source_section_title TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS review_sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_document_id TEXT NOT NULL,
      source_document_title TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      transcript TEXT NOT NULL,
      dialogue_turns TEXT NOT NULL,
      card_ids TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memory_documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_kind TEXT NOT NULL,
      source_ref_id TEXT NOT NULL,
      title TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      UNIQUE(source_kind, source_ref_id)
    );
    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      memory_document_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      section_title TEXT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS embeddings (
      chunk_id TEXT PRIMARY KEY,
      vector TEXT NOT NULL
    );
    "#,
  )?;

  migrate_documents_diagram_type(conn)?;

  let _ = conn.execute(
    "ALTER TABLE documents ADD COLUMN diagram_entities TEXT NOT NULL DEFAULT '[]'",
    [],
  );
  let _ = conn.execute(
    "ALTER TABLE documents ADD COLUMN mermaid TEXT NOT NULL DEFAULT 'flowchart LR'",
    [],
  );
  migrate_documents_json_type(conn)?;

  let has_selected = conn
    .prepare("SELECT is_selected FROM project_references LIMIT 1")
    .and_then(|mut stmt| stmt.exists([]))
    .is_ok();
  if !has_selected {
    let _ = conn.execute(
      "ALTER TABLE project_references ADD COLUMN is_selected INTEGER NOT NULL DEFAULT 1",
      [],
    );
  }

  let _ = conn.execute(
    "ALTER TABLE project_references ADD COLUMN reference_type TEXT NOT NULL DEFAULT 'file'",
    [],
  );
  let _ = conn.execute(
    "ALTER TABLE project_references ADD COLUMN source_url TEXT",
    [],
  );
  let _ = conn.execute(
    "ALTER TABLE project_references ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
    [],
  );
  let _ = conn.execute(
    "UPDATE project_references SET updated_at=created_at WHERE updated_at=''",
    [],
  );

  let _ = conn.execute(
    "ALTER TABLE agent_cards ADD COLUMN source_document_title TEXT",
    [],
  );
  let _ = conn.execute(
    "ALTER TABLE agent_cards ADD COLUMN source_section_title TEXT",
    [],
  );

  Ok(())
}

fn migrate_documents_json_type(conn: &Connection) -> rusqlite::Result<()> {
  let table_sql: String = conn.query_row(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'",
    [],
    |row| row.get(0),
  )?;

  if table_sql.contains("'json'") {
    return Ok(());
  }

  conn.execute_batch(
    r#"
    ALTER TABLE documents RENAME TO documents_old;
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('IDEA', 'PRD', 'PLAN', 'diagram', 'json')),
      markdown TEXT NOT NULL,
      diagram_entities TEXT NOT NULL DEFAULT '[]',
      mermaid TEXT NOT NULL DEFAULT 'flowchart LR',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO documents (id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at)
      SELECT id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at FROM documents_old;
    DROP TABLE documents_old;
    "#,
  )?;

  Ok(())
}

fn migrate_documents_diagram_type(conn: &Connection) -> rusqlite::Result<()> {
  let table_sql: String = conn.query_row(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'",
    [],
    |row| row.get(0),
  )?;

  if table_sql.contains("'diagram'") {
    return Ok(());
  }

  conn.execute_batch(
    r#"
    ALTER TABLE documents RENAME TO documents_old;
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('IDEA', 'PRD', 'PLAN', 'diagram')),
      markdown TEXT NOT NULL,
      diagram_entities TEXT NOT NULL DEFAULT '[]',
      mermaid TEXT NOT NULL DEFAULT 'flowchart LR',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO documents (id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at)
      SELECT id, project_id, name, document_type, markdown, '[]', 'flowchart LR', created_at, updated_at FROM documents_old;
    DROP TABLE documents_old;
    "#,
  )?;

  Ok(())
}
