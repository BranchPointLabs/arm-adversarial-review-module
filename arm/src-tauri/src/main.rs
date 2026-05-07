#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
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
struct DiagramEntity {
  id: String,
  name: String,
  responsibility: String,
  collaborators: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiagramEntityInput {
  id: String,
  name: String,
  responsibility: String,
  collaborators: Vec<String>,
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
  entities: Vec<DiagramEntity>,
  mermaid: String,
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
struct RetrievedMemoryChunk {
  chunk_id: String,
  document_title: String,
  section_title: Option<String>,
  text: String,
  similarity: f32,
  source_kind: String,
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
  source_document_title: Option<String>,
  source_section_title: Option<String>,
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
  source_document_title: Option<String>,
  source_section_title: Option<String>,
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

#[derive(Debug, Clone, Copy)]
enum MemorySourceKind {
  Document,
  Reference,
  Decision,
}

impl MemorySourceKind {
  fn as_str(self) -> &'static str {
    match self {
      MemorySourceKind::Document => "document",
      MemorySourceKind::Reference => "reference",
      MemorySourceKind::Decision => "decision",
    }
  }
}

#[derive(Debug, Clone)]
struct MemoryDocumentRow {
  id: String,
  content_hash: String,
}

#[derive(Debug, Clone)]
struct MemoryChunkRow {
  chunk_id: String,
  document_title: String,
  section_title: Option<String>,
  text: String,
  source_kind: String,
  source_ref_id: String,
  vector: Vec<f32>,
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
      "SELECT id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at
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
  let entities: Vec<DiagramEntityInput> = Vec::new();
  let mermaid = generate_mermaid(&entities);
  let markdown = default_document_markdown(trimmed, &document_type);
  conn
    .execute(
      "INSERT INTO documents (id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
      params![id, project_id, trimmed, document_type, markdown, "[]", mermaid, now, now],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;

  Ok(ProjectDocument {
    id,
    project_id,
    name: trimmed.to_string(),
    document_type,
    markdown,
    entities: Vec::new(),
    mermaid,
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
      "SELECT id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at FROM documents WHERE id=?1",
      params![document_id],
      map_document,
    )
    .map_err(to_err)
}

#[command]
fn save_diagram_document(
  project_path: String,
  document_id: String,
  entities: Vec<DiagramEntityInput>,
) -> Result<ProjectDocument, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let current_type: String = conn
    .query_row(
      "SELECT document_type FROM documents WHERE id=?1",
      params![document_id.clone()],
      |row| row.get(0),
    )
    .map_err(to_err)?;
  if current_type != "diagram" {
    return Err("Only diagram documents can save entity cards.".into());
  }

  let normalized = normalize_diagram_entities(entities);
  let entities_json = serde_json::to_string(&normalized).map_err(to_err)?;
  let mermaid = generate_mermaid(&normalized);
  let markdown = diagram_markdown(&normalized);
  let now = Utc::now().to_rfc3339();

  conn
    .execute(
      "UPDATE documents SET markdown=?1, diagram_entities=?2, mermaid=?3, updated_at=?4 WHERE id=?5",
      params![markdown, entities_json, mermaid, now, document_id],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;
  schedule_memory_reindex(project_path, MemorySourceKind::Document, document_id.clone());
  load_document_from_conn(&conn, &document_id)
}

#[command]
fn save_diagram_mermaid(project_path: String, document_id: String, mermaid: String) -> Result<ProjectDocument, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let current_type: String = conn
    .query_row(
      "SELECT document_type FROM documents WHERE id=?1",
      params![document_id.clone()],
      |row| row.get(0),
    )
    .map_err(to_err)?;
  if current_type != "diagram" {
    return Err("Only diagram documents can save Mermaid code.".into());
  }

  let mermaid = ensure_trailing_newline(&mermaid);
  let now = Utc::now().to_rfc3339();
  conn
    .execute(
      "UPDATE documents SET mermaid=?1, updated_at=?2 WHERE id=?3",
      params![mermaid, now, document_id],
    )
    .map_err(to_err)?;
  touch_project(&conn, &now).map_err(to_err)?;
  schedule_memory_reindex(project_path, MemorySourceKind::Document, document_id.clone());
  load_document_from_conn(&conn, &document_id)
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
  schedule_memory_reindex(project_path, MemorySourceKind::Document, document_id);
  Ok(())
}

#[command]
fn delete_document(project_path: String, document_id: String) -> Result<(), String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  conn
    .execute("DELETE FROM documents WHERE id=?1", params![document_id.clone()])
    .map_err(to_err)?;
  remove_memory_document(&conn, MemorySourceKind::Document, &document_id).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
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
  schedule_memory_reindex(project_path.clone(), MemorySourceKind::Decision, id.clone());

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
  for reference in &created {
    schedule_memory_reindex(project_path.clone(), MemorySourceKind::Reference, reference.id.clone());
  }
  Ok(created)
}

#[command]
fn update_reference(project_path: String, reference_id: String, patch: ReferencePatch) -> Result<ProjectReference, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  let current = load_reference(&conn, &reference_id)?;

  let should_reindex = patch.summary.is_some() || patch.extracted_text.is_some();
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
  if should_reindex {
    schedule_memory_reindex(project_path.clone(), MemorySourceKind::Reference, reference_id.clone());
  }
  load_reference(&conn, &reference_id)
}

#[command]
fn remove_reference(project_path: String, reference_id: String) -> Result<(), String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  conn
    .execute("DELETE FROM project_references WHERE id=?1", params![reference_id])
    .map_err(to_err)?;
  remove_memory_document(&conn, MemorySourceKind::Reference, &reference_id).map_err(to_err)?;
  let now = Utc::now().to_rfc3339();
  touch_project(&conn, &now).map_err(to_err)?;
  Ok(())
}

#[command]
fn retrieve_memory_context(
  project_path: String,
  active_document_id: Option<String>,
  current_document_markdown: String,
  focus_line: String,
  agent_type: String,
  limit: Option<usize>,
) -> Result<Vec<RetrievedMemoryChunk>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;
  ensure_project_memory_indexed(&project_path, &conn).map_err(to_err)?;

  let capped_limit = limit.unwrap_or(5).clamp(1, 8);
  let query = build_memory_query(&current_document_markdown, &focus_line, &agent_type);
  let results = search_memory(
    &conn,
    &query,
    active_document_id.as_deref(),
    capped_limit,
  )
  .map_err(to_err)?;

  if !results.is_empty() {
    let scores = results
      .iter()
      .map(|item| format!("{:.3}", item.similarity))
      .collect::<Vec<_>>()
      .join(", ");
    println!(
      "[arm-memory] retrieved={} scores=[{}] agent={} focus={}",
      results.len(),
      scores,
      agent_type,
      truncate_log_line(&focus_line, 120)
    );
  }

  Ok(results)
}

#[command]
fn list_agent_cards(project_path: String) -> Result<Vec<AgentCard>, String> {
  let project_path = PathBuf::from(project_path);
  let conn = open_project_conn(&project_path)?;

  let mut stmt = conn
    .prepare(
      "SELECT id, project_id, run_id, type, status, title, body, proposed_update, target_section, source_agent, source_document_title, source_section_title, created_at
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
        "INSERT INTO agent_cards (id, project_id, run_id, type, status, title, body, proposed_update, target_section, source_agent, source_document_title, source_section_title, created_at)
         VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
          card.source_document_title,
          card.source_section_title,
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
      source_document_title: card.source_document_title,
      source_section_title: card.source_section_title,
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
      document_type TEXT NOT NULL CHECK(document_type IN ('IDEA', 'PRD', 'PLAN', 'diagram')),
      markdown TEXT NOT NULL,
      diagram_entities TEXT NOT NULL DEFAULT '[]',
      mermaid TEXT NOT NULL DEFAULT 'flowchart LR',
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
      source_document_title TEXT,
      source_section_title TEXT,
      created_at TEXT NOT NULL
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
    "ALTER TABLE agent_cards ADD COLUMN source_document_title TEXT",
    [],
  );
  let _ = conn.execute(
    "ALTER TABLE agent_cards ADD COLUMN source_section_title TEXT",
    [],
  );

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
      "SELECT id, project_id, run_id, type, status, title, body, proposed_update, target_section, source_agent, source_document_title, source_section_title, created_at
       FROM agent_cards WHERE id=?1",
      params![card_id],
      map_agent_card,
    )
    .map_err(to_err)
}

fn load_document_from_conn(conn: &Connection, document_id: &str) -> Result<ProjectDocument, String> {
  conn
    .query_row(
      "SELECT id, project_id, name, document_type, markdown, diagram_entities, mermaid, created_at, updated_at FROM documents WHERE id=?1",
      params![document_id],
      map_document,
    )
    .map_err(to_err)
}

fn map_document(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectDocument> {
  let entities_json: String = row.get(5)?;
  let entity_inputs = serde_json::from_str::<Vec<DiagramEntityInput>>(&entities_json).unwrap_or_default();
  let entities = entity_inputs
    .into_iter()
    .map(|entity| DiagramEntity {
      id: entity.id,
      name: entity.name,
      responsibility: entity.responsibility,
      collaborators: entity.collaborators,
    })
    .collect();

  Ok(ProjectDocument {
    id: row.get(0)?,
    project_id: row.get(1)?,
    name: row.get(2)?,
    document_type: row.get(3)?,
    markdown: row.get(4)?,
    entities,
    mermaid: row.get(6)?,
    created_at: row.get(7)?,
    updated_at: row.get(8)?,
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
    source_document_title: row.get(10)?,
    source_section_title: row.get(11)?,
    created_at: row.get(12)?,
  })
}

fn schedule_memory_reindex(project_path: PathBuf, source_kind: MemorySourceKind, source_ref_id: String) {
  std::thread::spawn(move || {
    let result = (|| -> Result<(), String> {
      let conn = open_project_conn(&project_path)?;
      reindex_memory_document(&conn, source_kind, &source_ref_id).map_err(to_err)
    })();

    if let Err(error) = result {
      eprintln!(
        "[arm-memory] reindex failed kind={} ref={} error={}",
        source_kind.as_str(),
        source_ref_id,
        error
      );
    }
  });
}

fn ensure_project_memory_indexed(project_path: &Path, conn: &Connection) -> rusqlite::Result<()> {
  let mut doc_stmt = conn.prepare(
    "SELECT id FROM documents",
  )?;
  let document_ids = doc_stmt
    .query_map([], |row| row.get::<_, String>(0))?
    .filter_map(Result::ok)
    .collect::<Vec<_>>();
  for document_id in document_ids {
    reindex_memory_document(conn, MemorySourceKind::Document, &document_id)?;
  }

  let mut ref_stmt = conn.prepare("SELECT id FROM project_references")?;
  let reference_ids = ref_stmt
    .query_map([], |row| row.get::<_, String>(0))?
    .filter_map(Result::ok)
    .collect::<Vec<_>>();
  for reference_id in reference_ids {
    reindex_memory_document(conn, MemorySourceKind::Reference, &reference_id)?;
  }

  let mut decision_stmt = conn.prepare("SELECT id FROM decisions")?;
  let decision_ids = decision_stmt
    .query_map([], |row| row.get::<_, String>(0))?
    .filter_map(Result::ok)
    .collect::<Vec<_>>();
  for decision_id in decision_ids {
    reindex_memory_document(conn, MemorySourceKind::Decision, &decision_id)?;
  }

  let _ = project_path;
  Ok(())
}

fn reindex_memory_document(conn: &Connection, source_kind: MemorySourceKind, source_ref_id: &str) -> rusqlite::Result<()> {
  let Some((project_id, title, content, updated_at)) = load_memory_source(conn, source_kind, source_ref_id)? else {
    remove_memory_document(conn, source_kind, source_ref_id)?;
    return Ok(());
  };

  let normalized_content = content.trim();
  if normalized_content.is_empty() {
    remove_memory_document(conn, source_kind, source_ref_id)?;
    return Ok(());
  }

  let content_hash = stable_text_hash(normalized_content);
  let existing = load_memory_document(conn, source_kind, source_ref_id)?;
  if let Some(current) = existing.as_ref() {
    if current.content_hash == content_hash {
      return Ok(());
    }
  }

  let memory_document_id = existing
    .as_ref()
    .map(|row| row.id.clone())
    .unwrap_or_else(|| Uuid::new_v4().to_string());

  if existing.is_some() {
    conn.execute(
      "UPDATE memory_documents SET title=?1, updated_at=?2, content_hash=?3 WHERE id=?4",
      params![title, updated_at, content_hash, memory_document_id],
    )?;
  } else {
    conn.execute(
      "INSERT INTO memory_documents (id, project_id, source_kind, source_ref_id, title, updated_at, content_hash)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
      params![memory_document_id, project_id, source_kind.as_str(), source_ref_id, title, updated_at, content_hash],
    )?;
  }

  replace_memory_chunks(conn, &memory_document_id, &project_id, &title, normalized_content, &updated_at)?;
  Ok(())
}

fn load_memory_source(
  conn: &Connection,
  source_kind: MemorySourceKind,
  source_ref_id: &str,
) -> rusqlite::Result<Option<(String, String, String, String)>> {
  match source_kind {
    MemorySourceKind::Document => conn
      .query_row(
        "SELECT project_id, name, markdown, updated_at FROM documents WHERE id=?1",
        params![source_ref_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
      )
      .optional(),
    MemorySourceKind::Reference => conn
      .query_row(
        "SELECT project_id, file_name, COALESCE(extracted_text, summary, ''), created_at FROM project_references WHERE id=?1",
        params![source_ref_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
      )
      .optional(),
    MemorySourceKind::Decision => conn
      .query_row(
        "SELECT project_id, text, COALESCE(text, '') || CASE WHEN reason IS NOT NULL AND reason <> '' THEN '\n\nReason: ' || reason ELSE '' END, created_at FROM decisions WHERE id=?1",
        params![source_ref_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
      )
      .optional(),
  }
}

fn load_memory_document(
  conn: &Connection,
  source_kind: MemorySourceKind,
  source_ref_id: &str,
) -> rusqlite::Result<Option<MemoryDocumentRow>> {
  conn
    .query_row(
      "SELECT id, project_id, source_kind, source_ref_id, title, updated_at, content_hash
       FROM memory_documents WHERE source_kind=?1 AND source_ref_id=?2",
      params![source_kind.as_str(), source_ref_id],
      |row| {
        Ok(MemoryDocumentRow {
          id: row.get(0)?,
          content_hash: row.get(6)?,
        })
      },
    )
    .optional()
}

fn replace_memory_chunks(
  conn: &Connection,
  memory_document_id: &str,
  project_id: &str,
  title: &str,
  content: &str,
  updated_at: &str,
) -> rusqlite::Result<()> {
  let chunk_ids = conn
    .prepare("SELECT id FROM chunks WHERE memory_document_id=?1")?
    .query_map(params![memory_document_id], |row| row.get::<_, String>(0))?
    .filter_map(Result::ok)
    .collect::<Vec<_>>();

  for chunk_id in &chunk_ids {
    conn.execute("DELETE FROM embeddings WHERE chunk_id=?1", params![chunk_id])?;
  }
  conn.execute("DELETE FROM chunks WHERE memory_document_id=?1", params![memory_document_id])?;

  let chunks = chunk_markdown(title, content);
  for (index, chunk) in chunks.into_iter().enumerate() {
    let chunk_id = Uuid::new_v4().to_string();
    conn.execute(
      "INSERT INTO chunks (id, memory_document_id, project_id, chunk_index, section_title, text, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
      params![
        chunk_id,
        memory_document_id,
        project_id,
        index as i64,
        chunk.0,
        chunk.1,
        updated_at,
        updated_at,
      ],
    )?;
    let vector_json = serde_json::to_string(&embed_text(&chunk.1))
      .unwrap_or_else(|_| "[]".to_string());
    conn.execute(
      "INSERT INTO embeddings (chunk_id, vector) VALUES (?1, ?2)",
      params![chunk_id, vector_json],
    )?;
  }

  Ok(())
}

fn remove_memory_document(conn: &Connection, source_kind: MemorySourceKind, source_ref_id: &str) -> rusqlite::Result<()> {
  let memory_document = load_memory_document(conn, source_kind, source_ref_id)?;
  if let Some(row) = memory_document {
    let chunk_ids = conn
      .prepare("SELECT id FROM chunks WHERE memory_document_id=?1")?
      .query_map(params![row.id.clone()], |chunk_row| chunk_row.get::<_, String>(0))?
      .filter_map(Result::ok)
      .collect::<Vec<_>>();
    for chunk_id in &chunk_ids {
      conn.execute("DELETE FROM embeddings WHERE chunk_id=?1", params![chunk_id])?;
    }
    conn.execute("DELETE FROM chunks WHERE memory_document_id=?1", params![row.id.clone()])?;
    conn.execute("DELETE FROM memory_documents WHERE id=?1", params![row.id])?;
  }
  Ok(())
}

fn search_memory(
  conn: &Connection,
  query: &str,
  active_document_id: Option<&str>,
  limit: usize,
) -> rusqlite::Result<Vec<RetrievedMemoryChunk>> {
  let query_vector = embed_text(query);
  let mut stmt = conn.prepare(
    "SELECT chunks.id, memory_documents.title, chunks.section_title, chunks.text, memory_documents.source_kind, memory_documents.source_ref_id, embeddings.vector
     FROM chunks
     JOIN memory_documents ON memory_documents.id = chunks.memory_document_id
     JOIN embeddings ON embeddings.chunk_id = chunks.id
     WHERE chunks.project_id = memory_documents.project_id",
  )?;

  let rows = stmt.query_map([], |row| {
    let vector_json: String = row.get(6)?;
    let vector = parse_vector_json(&vector_json);
    Ok(MemoryChunkRow {
      chunk_id: row.get(0)?,
      document_title: row.get(1)?,
      section_title: row.get(2)?,
      text: row.get(3)?,
      source_kind: row.get(4)?,
      source_ref_id: row.get(5)?,
      vector,
    })
  })?;

  let mut scored = rows
    .filter_map(Result::ok)
    .filter(|row| !(row.source_kind == "document" && active_document_id.is_some() && Some(row.source_ref_id.as_str()) == active_document_id))
    .map(|row| {
      let similarity = cosine_similarity(&query_vector, &row.vector);
      (row, similarity)
    })
    .collect::<Vec<_>>();

  scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

  Ok(
    scored
      .into_iter()
      .take(limit)
      .map(|(row, similarity)| RetrievedMemoryChunk {
        chunk_id: row.chunk_id,
        document_title: row.document_title,
        section_title: row.section_title,
        text: truncate_log_line(&row.text, 900),
        similarity,
        source_kind: row.source_kind,
      })
      .collect(),
  )
}

fn build_memory_query(current_document_markdown: &str, focus_line: &str, agent_type: &str) -> String {
  let agent_hint = match agent_type {
    "product" => "Focus on product risk, user value, scope, and decision quality.",
    "technical" => "Focus on technical risk, implementation constraints, architecture, and operational failure modes.",
    _ => "Focus on contradictions, risks, open questions, and next steps.",
  };

  format!(
    "[Document Summary]\n{}\n\n[Focus Line]\n{}\n\n[Agent Lens Hint]\n{}",
    summarize_for_query(current_document_markdown, 1200),
    focus_line.trim(),
    agent_hint
  )
}

fn summarize_for_query(markdown: &str, max_chars: usize) -> String {
  let cleaned = markdown
    .lines()
    .map(str::trim)
    .filter(|line| !line.is_empty())
    .take(24)
    .collect::<Vec<_>>()
    .join("\n");
  truncate_log_line(&cleaned, max_chars)
}

fn chunk_markdown(title: &str, content: &str) -> Vec<(Option<String>, String)> {
  let max_tokens = 800usize;
  let min_tokens = 300usize;
  let mut sections: Vec<(Option<String>, Vec<String>)> = Vec::new();
  let mut current_section: Option<String> = Some(title.to_string());
  let mut current_block: Vec<String> = Vec::new();

  for line in content.lines() {
    let trimmed = line.trim_end();
    if let Some(section) = parse_heading(trimmed) {
      if !current_block.is_empty() {
        sections.push((current_section.clone(), current_block.clone()));
        current_block.clear();
      }
      current_section = Some(section);
      continue;
    }

    if trimmed.is_empty() {
      if !current_block.is_empty() {
        sections.push((current_section.clone(), current_block.clone()));
        current_block.clear();
      }
      continue;
    }

    current_block.push(trimmed.to_string());
  }

  if !current_block.is_empty() {
    sections.push((current_section.clone(), current_block));
  }

  let mut chunks = Vec::new();
  let mut chunk_section: Option<String> = None;
  let mut chunk_lines: Vec<String> = Vec::new();
  let mut chunk_tokens = 0usize;

  for (section_title, block_lines) in sections {
    let block_text = block_lines.join("\n");
    let block_tokens = approximate_tokens(&block_text);

    if block_tokens > max_tokens {
      for split in split_oversized_block(&block_text, max_tokens) {
        push_chunk_piece(
          &mut chunks,
          &mut chunk_section,
          &mut chunk_lines,
          &mut chunk_tokens,
          section_title.clone(),
          split,
          min_tokens,
          max_tokens,
        );
      }
      continue;
    }

    push_chunk_piece(
      &mut chunks,
      &mut chunk_section,
      &mut chunk_lines,
      &mut chunk_tokens,
      section_title,
      block_text,
      min_tokens,
      max_tokens,
    );
  }

  if !chunk_lines.is_empty() {
    chunks.push(finalize_chunk(chunk_section, chunk_lines));
  }

  chunks
}

fn push_chunk_piece(
  chunks: &mut Vec<(Option<String>, String)>,
  chunk_section: &mut Option<String>,
  chunk_lines: &mut Vec<String>,
  chunk_tokens: &mut usize,
  section_title: Option<String>,
  block_text: String,
  min_tokens: usize,
  max_tokens: usize,
) {
  let block_tokens = approximate_tokens(&block_text);
  let section_changed = chunk_section.as_deref() != section_title.as_deref();
  let would_overflow = *chunk_tokens + block_tokens > max_tokens;

  if !chunk_lines.is_empty() && (section_changed || (would_overflow && *chunk_tokens >= min_tokens)) {
    let lines = std::mem::take(chunk_lines);
    chunks.push(finalize_chunk(chunk_section.take(), lines));
    *chunk_tokens = 0;
  }

  if chunk_section.is_none() {
    *chunk_section = section_title.clone();
  }
  if !chunk_lines.is_empty() {
    chunk_lines.push(String::new());
  }
  chunk_lines.push(block_text);
  *chunk_tokens += block_tokens;
}

fn finalize_chunk(section_title: Option<String>, lines: Vec<String>) -> (Option<String>, String) {
  let body = lines.join("\n").trim().to_string();
  let text = if let Some(section) = section_title.as_ref() {
    format!("Section: {}\n---\n{}", section, body)
  } else {
    body
  };
  (section_title, text)
}

fn split_oversized_block(text: &str, max_tokens: usize) -> Vec<String> {
  let mut pieces = Vec::new();
  let mut current = Vec::new();
  let mut current_tokens = 0usize;

  for line in text.lines() {
    let line_tokens = approximate_tokens(line);
    if !current.is_empty() && current_tokens + line_tokens > max_tokens {
      pieces.push(current.join("\n"));
      current.clear();
      current_tokens = 0;
    }
    current.push(line.to_string());
    current_tokens += line_tokens;
  }

  if !current.is_empty() {
    pieces.push(current.join("\n"));
  }

  pieces
}

fn parse_heading(line: &str) -> Option<String> {
  let trimmed = line.trim();
  if !trimmed.starts_with('#') {
    return None;
  }
  let title = trimmed.trim_start_matches('#').trim();
  if title.is_empty() {
    None
  } else {
    Some(title.to_string())
  }
}

fn approximate_tokens(text: &str) -> usize {
  text.split_whitespace().count()
}

fn embed_text(text: &str) -> Vec<f32> {
  const EMBED_DIM: usize = 192;
  let normalized = normalize_text_for_embedding(text);
  if normalized.is_empty() {
    return vec![0.0; EMBED_DIM];
  }

  let tokens = normalized.split_whitespace().collect::<Vec<_>>();
  let mut vector = vec![0.0f32; EMBED_DIM];

  for token in &tokens {
    apply_feature(&mut vector, token, 1.0);
  }
  for window in tokens.windows(2) {
    apply_feature(&mut vector, &format!("{}__{}", window[0], window[1]), 0.8);
  }

  let magnitude = vector.iter().map(|value| value * value).sum::<f32>().sqrt();
  if magnitude > 0.0 {
    for value in &mut vector {
      *value /= magnitude;
    }
  }

  vector
}

fn normalize_text_for_embedding(text: &str) -> String {
  let mut output = String::with_capacity(text.len());
  let mut last_space = false;

  for ch in text.chars() {
    if ch.is_ascii_alphanumeric() {
      output.push(ch.to_ascii_lowercase());
      last_space = false;
    } else if !last_space {
      output.push(' ');
      last_space = true;
    }
  }

  output.trim().to_string()
}

fn apply_feature(vector: &mut [f32], feature: &str, weight: f32) {
  let hash = stable_text_hash(feature);
  let index = usize::from_str_radix(&hash[0..8], 16).unwrap_or(0) % vector.len();
  let sign = if usize::from_str_radix(&hash[8..16], 16).unwrap_or(0) % 2 == 0 { 1.0 } else { -1.0 };
  vector[index] += weight * sign;
}

fn stable_text_hash(value: &str) -> String {
  let mut hash = 1469598103934665603u64;
  for byte in value.as_bytes() {
    hash ^= u64::from(*byte);
    hash = hash.wrapping_mul(1099511628211);
  }
  format!("{:016x}", hash)
}

fn parse_vector_json(value: &str) -> Vec<f32> {
  serde_json::from_str::<Vec<f32>>(value).unwrap_or_default()
}

fn cosine_similarity(left: &[f32], right: &[f32]) -> f32 {
  if left.is_empty() || right.is_empty() || left.len() != right.len() {
    return 0.0;
  }
  left.iter().zip(right.iter()).map(|(a, b)| a * b).sum::<f32>()
}

fn truncate_log_line(value: &str, max_chars: usize) -> String {
  let cleaned = value.replace('\r', " ").replace('\n', " ").trim().to_string();
  if cleaned.chars().count() <= max_chars {
    return cleaned;
  }
  cleaned.chars().take(max_chars.saturating_sub(3)).collect::<String>() + "..."
}

fn default_document_markdown(name: &str, document_type: &str) -> String {
  if document_type == "diagram" {
    return ensure_trailing_newline(&format!("# {}\n\nNo diagram entities yet.", name));
  }

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
  if document_type == "IDEA" || document_type == "PRD" || document_type == "PLAN" || document_type == "diagram" {
    return Ok(());
  }
  Err("Document type must be IDEA, PRD, PLAN, or diagram.".into())
}

fn normalize_diagram_entities(entities: Vec<DiagramEntityInput>) -> Vec<DiagramEntityInput> {
  let known_ids = entities
    .iter()
    .filter_map(|entity| {
      let id = entity.id.trim();
      if id.is_empty() {
        None
      } else {
        Some(id.to_string())
      }
    })
    .collect::<std::collections::HashSet<_>>();

  entities
    .into_iter()
    .filter_map(|entity| {
      let id = entity.id.trim();
      let name = entity.name.trim();
      if id.is_empty() || name.is_empty() {
        return None;
      }

      let collaborators = entity
        .collaborators
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty() && value != id && known_ids.contains(value))
        .fold(Vec::new(), |mut acc, value| {
          if !acc.contains(&value) {
            acc.push(value);
          }
          acc
        });

      Some(DiagramEntityInput {
        id: id.to_string(),
        name: name.to_string(),
        responsibility: entity.responsibility.trim().to_string(),
        collaborators,
      })
    })
    .collect()
}

fn generate_mermaid(entities: &[DiagramEntityInput]) -> String {
  let mut lines = vec!["flowchart LR".to_string()];
  for entity in entities {
    lines.push(format!(
      "  {}[\"{}\"]",
      mermaid_id(&entity.id),
      mermaid_label(&entity.name, &entity.responsibility),
    ));
  }

  for entity in entities {
    for collaborator_id in &entity.collaborators {
      lines.push(format!("  {} --> {}", mermaid_id(&entity.id), mermaid_id(collaborator_id)));
    }
  }

  ensure_trailing_newline(&lines.join("\n"))
}

fn diagram_markdown(entities: &[DiagramEntityInput]) -> String {
  if entities.is_empty() {
    return "No diagram entities yet.\n".to_string();
  }

  let mut lines = Vec::new();
  for entity in entities {
    lines.push(format!("## {}", entity.name));
    if entity.responsibility.trim().is_empty() {
      lines.push("Responsibility:".to_string());
    } else {
      lines.push(format!("Responsibility: {}", entity.responsibility));
    }
    if entity.collaborators.is_empty() {
      lines.push("Collaborators: none".to_string());
    } else {
      lines.push(format!("Collaborators: {}", entity.collaborators.join(", ")));
    }
    lines.push(String::new());
  }

  ensure_trailing_newline(&lines.join("\n"))
}

fn mermaid_id(value: &str) -> String {
  let mut out = String::from("entity_");
  for ch in value.chars() {
    if ch.is_ascii_alphanumeric() {
      out.push(ch.to_ascii_lowercase());
    } else {
      out.push('_');
    }
  }
  out
}

fn mermaid_label(name: &str, responsibility: &str) -> String {
  let label = if responsibility.trim().is_empty() {
    name.trim().to_string()
  } else {
    format!("{}\nResponsibility: {}", name.trim(), responsibility.trim())
  };
  label.replace('\\', "\\\\").replace('"', "\\\"").replace('\n', "<br/>")
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
      delete_document,
      save_diagram_document,
      save_diagram_mermaid,
      add_chat_note,
      list_chat_notes,
      add_decision,
      list_decisions,
      list_references,
      add_references,
      update_reference,
      remove_reference,
      retrieve_memory_context,
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
