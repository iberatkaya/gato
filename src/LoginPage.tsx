import { useState } from "react";
import "./LoginPage.css";

interface LoginPageProps {
  onLogin: (username: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  // Hardcoded credentials
  const VALID_USERS = {
    admin: "123456",
    manager: "654321",
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !pin) {
      setError("Lütfen kullanıcı adı ve PIN kodunu giriniz");
      return;
    }

    if (pin.length !== 6 || !/^\d+$/.test(pin)) {
      setError("PIN kodu 6 haneli olmalıdır");
      return;
    }

    if (
      username in VALID_USERS &&
      VALID_USERS[username as keyof typeof VALID_USERS] === pin
    ) {
      onLogin(username);
    } else {
      setError("Hatalı kullanıcı adı veya PIN kodu");
      setPin("");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Gato Coffee Bar</h1>
        <p className="login-subtitle">Yönetim Paneli</p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="username">Kullanıcı Adı</label>
            <input
              id="username"
              type="text"
              placeholder="Kullanıcı adınızı giriniz"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="pin">PIN Kodu (6 haneli)</label>
            <input
              id="pin"
              type="password"
              placeholder="••••••"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "");
                setPin(val.slice(0, 6));
              }}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button">
            Giriş Yap
          </button>
        </form>

        <div className="demo-credentials">
          <p style={{ marginBottom: "8px", fontSize: "0.9rem", opacity: 0.7 }}>
            Demo Hesapları:
          </p>
          <p style={{ fontSize: "0.85rem", margin: "4px 0" }}>
            👤 admin / 📍 123456
          </p>
          <p style={{ fontSize: "0.85rem", margin: "4px 0" }}>
            👤 manager / 📍 654321
          </p>
        </div>
      </div>
    </div>
  );
}
