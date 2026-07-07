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
    <aside
      className={`${hideSidebar ? "hidden md:flex" : "flex"} flex-col w-full md:w-60 bg-slate-100 border-r border-gray-300 shrink-0 min-h-0`}
    >
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg mb-3">mamimu</h1>
        <button
          className="w-full px-5 py-2 border border-gray-400 rounded-md bg-white cursor-pointer text-sm hover:bg-gray-200"
          onClick={onCreateFile}
        >
          + New
        </button>
      </div>
      <ul className="list-none overflow-y-auto flex-1 p-0">
        {files.map((file) => (
          <li
            key={file.id}
            className={`group flex justify-between items-center px-4 py-3 md:px-3 md:py-2 cursor-pointer border-b border-gray-100 hover:bg-gray-100${currentFile?.id === file.id ? " bg-white" : ""}`}
            onClick={() => onSelectFile(file)}
          >
            <span className="truncate flex-1 text-sm">{file.name}</span>
            <button
              className="opacity-0 bg-transparent border-none cursor-pointer text-gray-400 text-lg px-1 leading-none group-hover:opacity-100 hover:text-red-500"
              onClick={(e) => onDeleteFile(file.id, e)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
