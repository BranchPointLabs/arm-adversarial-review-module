#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{command, Manager};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
  base_dir: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Project {
  id: String,
  name: String,
  path: String,
  created_at: String,
  updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ChatNote {
  id: String,
  project_id: String,
  text: String,
  tags: Option<Vec<String>>,
  created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Decision {
  id: String,
  project_id: String,
  text: String,
  reason: Option<String>,
  created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectDocument {
  id: String,
  project_id: String,
  name: String,
  #[serde(rename = "type")]
  document_type: String,
  markdown: String,
  created_at: String,
  updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectReference {
  id: String,
  project_id: String,
  file_name: String,
  file_path: Option<String>,
  extracted_text: Option<String>,
  summary: Option<String>,
  is_selected: bool,
  created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentCard {
  id: String,
  project_id: String,
  run_id: String,
  #[serde(rename = "type")]
  card_type: String,
  status: String,
  title: String,
  body: String,
  proposed_update: Option<String>,
  target_section: Option<String>,
  source_agent: String,
  created_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewReferenceInput {
  file_name: String,
  file_path: Option<String>,
  extracted_text: Option<String>,
  summary: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReferencePatch {
  summary: Option<String>,
  extracted_text: Option<String>,
  is_selected: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NewAgentCardInput {
  #[serde(rename = "type")]
  card_type: String,
  title: String,
  body: String,
  proposed_update: Option<String>,
  target_section: Option<String>,
  source_agent: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentCardPatch {
  status: Option<String>,
  title: Option<String>,
  body: Option<String>,
  proposed_update: Option<String>,
  target_section: Option<String>,
}

#[command]
fn list_projects(state: tauri::State<AppState>) -> Result<Vec<Project>, String> {
  let mut projects = Vec::new();
  if !state.base_dir.exists() {
    return Ok(projects);
  }

  let entries = fs::read_dir(&state.base_dir).map_err(to_err)?;
  for entry in entries {
    let entry = entry.map_err(to_err)?;
    let path = entry.path();
    if !path.is_dir() {
      continue;
    }

    let db_path = path.join("arm.db");
    if !db_path.exists() {
      continue;
    }

    let conn = Connection::open(db_path).map_err(to_err)?;
    init_schema(&conn).map_err(to_err)?;
    let mut stmt = conn
      .prepare("SELECT id, name, created_at, updated_at FROM projects LIMIT 1")
      .map_err(to_err)?;
    let mut rows = stmt.query([]).map_err(to_err)?;
    if let Some(row) = rows.next().map_err(to_err)? {
      projects.push(Project {
        id: row.get(0).map_err(to_err)?,
        name: row.get(1).map_err(to_err)?,
        path: path.to_string_lossy().to_string(),
        created_at: row.get(2).map_err(to_err)?,
        updated_at: row.get(3).map_err(to_err)?,
      });
    }
  }

  projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
  Ok(projects)
}

#[command]
fn create_project(state: tauri::State<AppState>, name: String) -> Result<Project, String> {
  let trimmed = name.trim();
  if trimmed.len() < 2 {
    return Err("Project name too short.".into());
  }

  fs::create_dir_all(&state.base_dir).map_err(to_err)?;
  let slug = slugify(trimmed);
  let project_path = state.base_dir.join(slug);
  if project_path.exists() {
    return Err("Project folder already exists.".into());
  }

  let created = (|| -> Result<Project, String> {
    init_project_folder(&project_path).map_err(to_err)?;

    let conn = open_project_conn(&project_path)?;
    let now = Utc::now().to_rfc3339();
    let id = Uuid::new_v4().to_string();
    conn
      .execute(
        "INSERT INTO projects (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        params![id, trimmed, now, now],
      )
      .map_err(to_err)?;

    Ok(Project {
      id,
      name: trimmed.to_string(),
      path: project_path.to_string_lossy().to_string(),
      created_at: now.clone(),
      updated_at: now,
    })
  })();

  if created.is_err() {
    let _ = fs::remove_dir_all(&project_path);
  }

  created
}

#[command]
fn list_documents(project_path: String) -> Result<Vec<ProjectDocument>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  let mut stmt = conn
    .prepare(
      "SELECT id, project_id, name, document_type, markdown, created_at, updated_at
       FROM documents
       ORDER BY updated_at DESC",
    )
    .map_err(to_err)?;
  let rows = stmt
    .query_map([], map_document)
    .map_err(to_err)?;

  Ok(rows.filter_map(Result::ok).collect())
}

#[command]
fn create_document(project_path: String, name: String, document_type: String) -> Result<ProjectDocument, String> {
  let trimmed = name.trim();
  if trimmed.len() < 2 {
    return Err("Document name too short.".into());
  }
  validate_document_type(&document_type)?;

  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let project_id = get_project_id(&conn).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  let id = Uuid::new_v4().to_string();
  let markdown = default_document_markdown(trimmed, &document_type);
  conn
    .execute(
      "INSERT INTO documents (id, project_id, name, document_type, markdown, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      params![id, project_id, trimmed, document_type, markdown, now, now],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;

  Ok(ProjectDocument {
    id,
    project_id,
    name: trimmed.to_string(),
    document_type,
    markdown,
    created_at: now.clone(),
    updated_at: now,
  })
}

#[command]
fn load_document(project_path: String, document_id: String) -> Result<ProjectDocument, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  conn
    .query_row(
      "SELECT id, project_id, name, document_type, markdown, created_at, updated_at FROM documents WHERE id=?1",
      params![document_id],
      map_document,
    )
    .map_err(to_err)
}

#[command]
fn save_document(project_path: String, document_id: String, markdown: String) -> Result<(), String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let markdown = ensure_trailing_newline(&markdown);
  let now = Utc::now().to_rfc3339();

  conn
    .execute(
      "UPDATE documents SET markdown=?1, updated_at=?2 WHERE id=?3",
      params![markdown, now, document_id],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;
  Ok(())
}

#[command]
fn add_chat_note(project_path: String, text: String, tags: Option<Vec<String>>) -> Result<ChatNote, String> {
  let trimmed = text.trim();
  if trimmed.is_empty() {
    return Err("Chat note cannot be empty.".into());
  }

  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let project_id = get_project_id(&conn).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  let id = Uuid::new_v4().to_string();
  let tags_json = tags.as_ref().map(|value| serde_json::to_string(value).unwrap_or("[]".to_string()));
  conn
    .execute(
      "INSERT INTO chat_notes (id, project_id, text, tags, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      params![id, project_id, trimmed, tags_json, now],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;

  Ok(ChatNote {
    id,
    project_id,
    text: trimmed.to_string(),
    tags,
    created_at: now,
  })
}

#[command]
fn list_chat_notes(project_path: String) -> Result<Vec<ChatNote>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  let mut stmt = conn
    .prepare("SELECT id, project_id, text, tags, created_at FROM chat_notes ORDER BY created_at DESC LIMIT 100")
    .map_err(to_err)?;
  let rows = stmt
    .query_map([], |row| {
      let tags_raw: Option<String> = row.get(3)?;
      let tags = tags_raw.and_then(|value| serde_json::from_str(&value).ok());
      Ok(ChatNote {
        id: row.get(0)?,
        project_id: row.get(1)?,
        text: row.get(2)?,
        tags,
        created_at: row.get(4)?,
      })
    })
    .map_err(to_err)?;

  Ok(rows.filter_map(Result::ok).collect())
}

#[command]
fn add_decision(project_path: String, text: String, reason: Option<String>) -> Result<Decision, String> {
  let trimmed = text.trim();
  if trimmed.is_empty() {
    return Err("Decision cannot be empty.".into());
  }

  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let project_id = get_project_id(&conn).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  let id = Uuid::new_v4().to_string();
  conn
    .execute(
      "INSERT INTO decisions (id, project_id, text, reason, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
      params![id, project_id, trimmed, reason.as_deref(), now],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;

  Ok(Decision {
    id,
    project_id,
    text: trimmed.to_string(),
    reason,
    created_at: now,
  })
}

#[command]
fn list_decisions(project_path: String) -> Result<Vec<Decision>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  let mut stmt = conn
    .prepare("SELECT id, project_id, text, reason, created_at FROM decisions ORDER BY created_at DESC LIMIT 100")
    .map_err(to_err)?;
  let rows = stmt
    .query_map([], |row| {
      Ok(Decision {
        id: row.get(0)?,
        project_id: row.get(1)?,
        text: row.get(2)?,
        reason: row.get(3)?,
        created_at: row.get(4)?,
      })
    })
    .map_err(to_err)?;

  Ok(rows.filter_map(Result::ok).collect())
}

#[command]
fn list_references(project_path: String) -> Result<Vec<ProjectReference>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  let mut stmt = conn
    .prepare(
      "SELECT id, project_id, file_name, file_path, extracted_text, summary, is_selected, created_at
       FROM project_references
       ORDER BY created_at DESC",
    )
    .map_err(to_err)?;
  let rows = stmt
    .query_map([], map_reference)
    .map_err(to_err)?;

  Ok(rows.filter_map(Result::ok).collect())
}

#[command]
fn add_references(project_path: String, references: Vec<NewReferenceInput>) -> Result<Vec<ProjectReference>, String> {
  if references.is_empty() {
    return Ok(Vec::new());
  }

  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let project_id = get_project_id(&conn).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  let mut created = Vec::new();

  for reference in references {
    let file_name = reference.file_name.trim();
    if file_name.is_empty() {
      continue;
    }

    let id = Uuid::new_v4().to_string();
    conn
      .execute(
        "INSERT INTO project_references (id, project_id, file_name, file_path, extracted_text, summary, is_selected, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
          id,
          project_id,
          file_name,
          reference.file_path,
          reference.extracted_text,
          reference.summary,
          1,
          now
        ],
      )
      .map_err(to_err)?;

    created.push(ProjectReference {
      id,
      project_id: project_id.clone(),
      file_name: file_name.to_string(),
      file_path: reference.file_path,
      extracted_text: reference.extracted_text,
      summary: reference.summary,
      is_selected: true,
      created_at: now.clone(),
    });
  }

  touch_project(&conn, &now).map_err(to_err)?;
  Ok(created)
}

#[command]
fn update_reference(project_path: String, reference_id: String, patch: ReferencePatch) -> Result<ProjectReference, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let current = load_reference(&conn, &reference_id)?;

  let summary = patch.summary.or(current.summary);
  let extracted_text = patch.extracted_text.or(current.extracted_text);
  let is_selected = patch.is_selected.unwrap_or(current.is_selected);
  conn
    .execute(
      "UPDATE project_references SET summary=?1, extracted_text=?2, is_selected=?3 WHERE id=?4",
      params![summary, extracted_text, bool_to_int(is_selected), reference_id],
    )
    .map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  touch_project(&conn, &now).map_err(to_err)?;
  load_reference(&conn, &reference_id)
}

#[command]
fn remove_reference(project_path: String, reference_id: String) -> Result<(), String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  conn
    .execute("DELETE FROM project_references WHERE id=?1", params![reference_id])
    .map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  touch_project(&conn, &now).map_err(to_err)?;
  Ok(())
}

#[command]
fn list_agent_cards(project_path: String) -> Result<Vec<AgentCard>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  let mut stmt = conn
    .prepare(
      "SELECT id, project_id, run_id, type, status, title, body, proposed_update, target_section, source_agent, created_at
       FROM agent_cards
       ORDER BY created_at DESC",
    )
    .map_err(to_err)?;
  let rows = stmt
    .query_map([], map_agent_card)
    .map_err(to_err)?;

  Ok(rows.filter_map(Result::ok).collect())
}

#[command]
fn create_agent_cards(project_path: String, source_agent: String, cards: Vec<NewAgentCardInput>) -> Result<Vec<AgentCard>, String> {
  if cards.is_empty() {
    return Ok(Vec::new());
  }

  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let project_id = get_project_id(&conn).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  let run_id = Uuid::new_v4().to_string();
  conn
    .execute(
      "INSERT INTO agent_runs (id, project_id, agent, created_at) VALUES (?1, ?2, ?3, ?4)",
      params![run_id, project_id, source_agent, now],
    )
    .map_err(to_err)?;

  let mut created = Vec::new();
  for card in cards {
    validate_card_type(&card.card_type)?;
    let id = Uuid::new_v4().to_string();
    conn
      .execute(
        "INSERT INTO agent_cards (id, project_id, run_id, type, status, title, body, proposed_update, target_section, source_agent, created_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
          id,
          project_id,
          run_id,
          card.card_type,
          card.title,
          card.body,
          card.proposed_update,
          card.target_section,
          card.source_agent,
          now
        ],
      )
      .map_err(to_err)?;

    created.push(AgentCard {
      id,
      project_id: project_id.clone(),
      run_id: run_id.clone(),
      card_type: card.card_type,
      status: "pending".to_string(),
      title: card.title,
      body: card.body,
      proposed_update: card.proposed_update,
      target_section: card.target_section,
      source_agent: card.source_agent,
      created_at: now.clone(),
    });
  }

  touch_project(&conn, &now).map_err(to_err)?;
  Ok(created)
}

#[command]
fn update_agent_card(project_path: String, card_id: String, patch: AgentCardPatch) -> Result<AgentCard, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let current = load_agent_card(&conn, &card_id)?;

  let status = patch.status.unwrap_or(current.status);
  validate_card_status(&status)?;
  let title = patch.title.unwrap_or(current.title);
  let body = patch.body.unwrap_or(current.body);
  let proposed_update = patch.proposed_update.or(current.proposed_update);
  let target_section = patch.target_section.or(current.target_section);

  conn
    .execute(
      "UPDATE agent_cards SET status=?1, title=?2, body=?3, proposed_update=?4, target_section=?5 WHERE id=?6",
      params![status, title, body, proposed_update, target_section, card_id],
    )
    .map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  touch_project(&conn, &now).map_err(to_err)?;
  load_agent_card(&conn, &card_id)
}

fn init_project_folder(project_path: &Path) -> std::io::Result<()> {
  fs::create_dir_all(project_path.join("context"))?;
  fs::create_dir_all(project_path.join("references"))?;
  fs::create_dir_all(project_path.join("runs"))?;

  fs::write(project_path.join("context").join("decisions.md"), ensure_trailing_newline("# Decisions\n"))?;
  fs::write(project_path.join("context").join("idea_log.md"), ensure_trailing_newline("# Idea Log\n"))?;
  Ok(())
}

fn open_project_conn(project_path: &Path) -> Result<Connection, String> {
  let db_path = project_path.join("arm.db");
  let conn = Connection::open(db_path).map_err(to_err)?;
  init_schema(&conn).map_err(to_err)?;
  Ok(conn)
}

fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
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
      document_type TEXT NOT NULL CHECK(document_type IN ('IDEA', 'PRD', 'PLAN')),
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS project_references (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      extracted_text TEXT,
      summary TEXT,
      is_selected INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
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
      created_at TEXT NOT NULL
    );
    "#,
  )?;

  migrate_documents_plan_type(conn)?;

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

  Ok(())
}

fn migrate_documents_plan_type(conn: &Connection) -> rusqlite::Result<()> {
  let table_sql: String = conn.query_row(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='documents'",
    [],
    |row| row.get(0),
  )?;

  if table_sql.contains("'PLAN'") {
    return Ok(());
  }

  conn.execute_batch(
    r#"
    ALTER TABLE documents RENAME TO documents_old;
    CREATE TABLE documents (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      document_type TEXT NOT NULL CHECK(document_type IN ('IDEA', 'PRD', 'PLAN')),
      markdown TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    INSERT INTO documents (id, project_id, name, document_type, markdown, created_at, updated_at)
      SELECT id, project_id, name, document_type, markdown, created_at, updated_at FROM documents_old;
    DROP TABLE documents_old;
    "#,
  )?;

  Ok(())
}

fn touch_project(conn: &Connection, timestamp: &str) -> rusqlite::Result<()> {
  conn.execute("UPDATE projects SET updated_at=?1", params![timestamp])?;
  Ok(())
}

fn get_project_id(conn: &Connection) -> rusqlite::Result<String> {
  conn.query_row("SELECT id FROM projects LIMIT 1", [], |row| row.get(0))
}

fn load_reference(conn: &Connection, reference_id: &str) -> Result<ProjectReference, String> {
  conn
    .query_row(
      "SELECT id, project_id, file_name, file_path, extracted_text, summary, is_selected, created_at
       FROM project_references WHERE id=?1",
      params![reference_id],
      map_reference,
    )
    .map_err(to_err)
}

fn load_agent_card(conn: &Connection, card_id: &str) -> Result<AgentCard, String> {
  conn
    .query_row(
      "SELECT id, project_id, run_id, type, status, title, body, proposed_update, target_section, source_agent, created_at
       FROM agent_cards WHERE id=?1",
      params![card_id],
      map_agent_card,
    )
    .map_err(to_err)
}

fn map_document(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectDocument> {
  Ok(ProjectDocument {
    id: row.get(0)?,
    project_id: row.get(1)?,
    name: row.get(2)?,
    document_type: row.get(3)?,
    markdown: row.get(4)?,
    created_at: row.get(5)?,
    updated_at: row.get(6)?,
  })
}

fn map_reference(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectReference> {
  Ok(ProjectReference {
    id: row.get(0)?,
    project_id: row.get(1)?,
    file_name: row.get(2)?,
    file_path: row.get(3)?,
    extracted_text: row.get(4)?,
    summary: row.get(5)?,
    is_selected: int_to_bool(row.get::<_, i64>(6)?),
    created_at: row.get(7)?,
  })
}

fn map_agent_card(row: &rusqlite::Row<'_>) -> rusqlite::Result<AgentCard> {
  Ok(AgentCard {
    id: row.get(0)?,
    project_id: row.get(1)?,
    run_id: row.get(2)?,
    card_type: row.get(3)?,
    status: row.get(4)?,
    title: row.get(5)?,
    body: row.get(6)?,
    proposed_update: row.get(7)?,
    target_section: row.get(8)?,
    source_agent: row.get(9)?,
    created_at: row.get(10)?,
  })
}

fn default_document_markdown(name: &str, document_type: &str) -> String {
  if document_type == "PLAN" {
    return ensure_trailing_newline(&format!(
      "# {}\n\n## Initiative 1\n- Source: \n- Why: \n- Action: \n- Success Signal: \n\n## Decision after execution\n- [ ] Proceed\n- [ ] Iterate\n- [ ] Kill\n",
      name
    ));
  }

  if document_type == "PRD" {
    return ensure_trailing_newline(&format!(
      "# {}\n\n## Problem\n- \n\n## Users\n- \n\n## Scope\n- \n\n## Requirements\n- \n\n## Risks\n- \n\n## Open Questions\n- \n",
      name
    ));
  }

  ensure_trailing_newline(&format!(
    "# {}\n\n## Idea\n- \n\n## Why it matters\n- \n\n## Current assumptions\n- \n\n## Risks\n- \n\n## Next actions\n- \n",
    name
  ))
}

fn validate_document_type(document_type: &str) -> Result<(), String> {
  if document_type == "IDEA" || document_type == "PRD" || document_type == "PLAN" {
    return Ok(());
  }
  Err("Document type must be IDEA, PRD, or PLAN.".into())
}

fn validate_card_type(card_type: &str) -> Result<(), String> {
  match card_type {
    "info" | "open_question" | "action" | "warning" => Ok(()),
    _ => Err("Card type is invalid.".into()),
  }
}

fn validate_card_status(status: &str) -> Result<(), String> {
  match status {
    "pending" | "accepted" | "rejected" | "edited" | "resolved" => Ok(()),
    _ => Err("Card status is invalid.".into()),
  }
}

fn slugify(value: &str) -> String {
  let mut out = String::new();
  for ch in value.chars() {
    if ch.is_ascii_alphanumeric() {
      out.push(ch.to_ascii_lowercase());
    } else if (ch.is_ascii_whitespace() || ch == '-' || ch == '_') && !out.ends_with('-') {
      out.push('-');
    }
  }
  out.trim_matches('-').to_string()
}

fn ensure_trailing_newline(value: &str) -> String {
  let trimmed = value.trim_end_matches(['\r', '\n']);
  format!("{}\n", trimmed)
}

fn bool_to_int(value: bool) -> i64 {
  if value { 1 } else { 0 }
}

fn int_to_bool(value: i64) -> bool {
  value != 0
}

fn to_err<E: std::fmt::Display>(error: E) -> String {
  error.to_string()
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let base_dir = resolve_projects_base_dir(app)?;
      app.manage(AppState { base_dir });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      list_projects,
      create_project,
      list_documents,
      create_document,
      load_document,
      save_document,
      add_chat_note,
      list_chat_notes,
      add_decision,
      list_decisions,
      list_references,
      add_references,
      update_reference,
      remove_reference,
      list_agent_cards,
      create_agent_cards,
      update_agent_card
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn resolve_projects_base_dir(app: &tauri::App) -> Result<PathBuf, String> {
  let docs = app
    .path()
    .resolve("ARM", BaseDirectory::Document)
    .map_err(|error| error.to_string())?;
  if fs::create_dir_all(&docs).is_ok() {
    return Ok(docs);
  }

  let app_data = app
    .path()
    .resolve("ARM", BaseDirectory::AppData)
    .map_err(|error| error.to_string())?;
  fs::create_dir_all(&app_data).map_err(to_err)?;
  Ok(app_data)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn init_schema_executes() {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    init_schema(&conn).expect("schema should initialize");
  }

  #[test]
  fn slugify_trims_and_normalizes() {
    assert_eq!(slugify(" ARM Project  One "), "arm-project-one");
  }
}
