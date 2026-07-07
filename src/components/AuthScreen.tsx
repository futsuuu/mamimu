interface Props {
  onLogin: () => void;
}

export default function AuthScreen({ onLogin }: Props) {
  return (
    <div className="auth-screen">
      <h1>mamimu</h1>
      <button className="btn btn-auth" onClick={onLogin}>
        Sign in with Google
      </button>
    </div>
  );
}
