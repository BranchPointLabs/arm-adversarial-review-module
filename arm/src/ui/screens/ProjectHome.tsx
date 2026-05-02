import React from "react";
import { useNavigate } from "react-router-dom";
import { Project, projectStore } from "../../core/projectStore";

export default function ProjectHome(props: { onCreateProject: () => void }) {
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

        <section className="surfaceCard homeGuide armLanding">
          <div className="landingEyebrow">Adversarial Review Module</div>
          <div className="landingHero">
            <h1>Challenge the document. Keep control of the work.</h1>
            <p>
              ARM is a review workspace for product documents. Ask targeted questions about a PRD,
              idea, or plan, then turn useful feedback into small cards, decisions, and controlled document updates.
            </p>
          </div>

          <div className="landingGrid">
            <section className="landingPanel">
              <div className="landingPanelTitle">The Goal</div>
              <p>
                Help technical PMs and product leaders identify weak assumptions, hidden risks, and unclear decisions
                without handing the whole artifact over to an AI writer.
              </p>
            </section>

            <section className="landingPanel">
              <div className="landingPanelTitle">How It Works</div>
              <ol className="landingSteps">
                <li>Ask a focused question.</li>
                <li>Review concise cards.</li>
                <li>Accept, dismiss, or resolve.</li>
                <li>Evolve the selected document.</li>
              </ol>
            </section>
          </div>

          <div className="landingFooter">
            <p>AI does not replace your document. It challenges it.</p>
            <button type="button" className="primary landingCta" onClick={props.onCreateProject}>
              Create Project
            </button>
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
