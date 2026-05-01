import React from "react";
import { useParams } from "react-router-dom";

export default function ReferencesScreen() {
  const params = useParams();
  const projectPath = params.projectPath ? decodeURIComponent(params.projectPath) : "";

  return (
    <div className="page">
      <div className="surfaceCard">
        <div className="surfaceTitle">References</div>
        <div className="surfaceCopy">
          The roadmap calls for drag and drop references plus optional extracted text and summary storage.
          That flow is not wired yet.
        </div>
        <div className="surfaceMeta">Target project: {projectPath || "None selected"}</div>
      </div>
    </div>
  );
}
