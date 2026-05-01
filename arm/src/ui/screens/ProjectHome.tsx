import React from "react";
import { useNavigate } from "react-router-dom";
import { Project, projectStore } from "../../core/projectStore";

export default function ProjectHome() {
  const navigate = useNavigate();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [status, setStatus] = React.useState<string | null>(null);

  React.useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      setProjects(await projectStore.listProjects());
      setStatus(null);
    } catch (error: any) {
      setStatus(typeof error === "string" ? error : error?.message || "Failed to load projects.");
    }
  }

  return (
    <div className="page">
      <div className="homeLayout">
        <section className="surfaceCard recentProjectsPane">
          <div className="surfaceTitle">Recent Projects</div>
          <div className="list compact recentProjectsList">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="projectSummaryItem"
                onClick={() => navigate(`/p/${encodeURIComponent(project.path)}/context`)}
              >
                <div className="listTitle">{project.name}</div>
                <div className="listMeta">{formatRelativeTime(project.updatedAt)}</div>
              </button>
            ))}
            {projects.length === 0 ? <div className="muted">No projects yet.</div> : null}
          </div>
        </section>

        <section className="surfaceCard homeGuide">
          <div className="surfaceTitle">Workspace</div>
          <p className="surfaceCopy">
            ARM keeps one living context document per project, then layers notes, decisions, references, and review
            cards around it.
          </p>
          <div className="guideGrid">
            <div className="guideItem">
              <div className="guideLabel">1</div>
              <div>Create or select a project from the app bar.</div>
            </div>
            <div className="guideItem">
              <div className="guideLabel">2</div>
              <div>Add notes, decisions, and references as you work.</div>
            </div>
            <div className="guideItem">
              <div className="guideLabel">3</div>
              <div>Run a review, accept the useful cards, then update context.</div>
            </div>
          </div>
          {status ? <div className="noticeCard homeNotice">{status}</div> : null}
        </section>
      </div>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "Updated recently";

  const deltaSeconds = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (deltaSeconds < 60) return "Updated just now";
  if (deltaSeconds < 3600) return `Updated ${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `Updated ${Math.floor(deltaSeconds / 3600)}h ago`;
  if (deltaSeconds < 604800) return `Updated ${Math.floor(deltaSeconds / 86400)}d ago`;
  return `Updated ${new Date(value).toLocaleDateString()}`;
}
