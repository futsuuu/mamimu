interface Props {
  onLogin: () => void;
}

export default function AuthScreen({ onLogin }: Props) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-4">
      <h1 className="text-2xl">mamimu</h1>
      <button
        className="px-5 py-2 border border-gray-400 rounded-md bg-white cursor-pointer text-base hover:bg-gray-200"
        onClick={onLogin}
      >
        Sign in with Google
      </button>
    </div>
  );
}
