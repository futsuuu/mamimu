interface Props {
  files: { id: string; name: string }[];
  currentFile: { id: string; name: string } | null;
  sidebarOpen: boolean;
  onSelectFile: (file: { id: string; name: string }) => void;
  onCreateFile: () => void;
  onDeleteFile: (fileId: string, e: React.MouseEvent) => void;
}

export default function Sidebar({
  files,
  currentFile,
  sidebarOpen,
  onSelectFile,
  onCreateFile,
  onDeleteFile,
}: Props) {
  const hideSidebar = !sidebarOpen && !!currentFile;

  return (
    <aside className={`sidebar${hideSidebar ? " hidden" : ""}`}>
      <div className="sidebar-header">
        <h1 className="sidebar-title">mamimu</h1>
        <button className="btn btn-new" onClick={onCreateFile}>
          + New
        </button>
      </div>
      <ul className="file-list">
        {files.map((file) => (
          <li
            key={file.id}
            className={`file-item${currentFile?.id === file.id ? " active" : ""}`}
            onClick={() => onSelectFile(file)}
          >
            <span className="file-name">{file.name}</span>
            <button className="btn-delete" onClick={(e) => onDeleteFile(file.id, e)}>
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
