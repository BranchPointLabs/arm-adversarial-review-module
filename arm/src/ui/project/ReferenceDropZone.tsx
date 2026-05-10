import React from "react";

export default function ReferenceDropZone(props: { onFiles: (files: FileList | null) => void; onPickFiles: () => void }) {
  const [dragging, setDragging] = React.useState(false);

  return (
    <div
      className={"referenceDropZone" + (dragging ? " active" : "")}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        props.onFiles(event.dataTransfer.files);
      }}
    >
      <div className="surfaceTitle">Drop text files here</div>
      <div className="surfaceCopy">Supports markdown, plain text, code, config, and other readable text files.</div>
      <button type="button" className="secondary" onClick={props.onPickFiles}>
        Pick Files
      </button>
    </div>
  );
}
