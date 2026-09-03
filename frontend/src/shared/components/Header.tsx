import { Bell, LogOut, Menu, Search } from "lucide-react";
import { useAuth } from "@/app/providers/auth-context";
export function Header({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const initials = user?.nombreCompleto
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <header className="header">
      <button
        className="icon-button mobile-menu"
        onClick={onMenu}
        aria-label="Abrir navegación"
      >
        <Menu size={21} />
      </button>
      <div className="search">
        <Search size={18} />
        <input aria-label="Buscar" placeholder="Buscar..." />
      </div>
      <div className="header-actions">
        <button className="icon-button" aria-label="Notificaciones">
          <Bell size={19} />
          <span className="notification-dot" />
        </button>
        <div className="user">
          <div className="avatar">{initials}</div>
          <div>
            <strong>{user?.nombreCompleto}</strong>
            <span>{user?.rol}</span>
          </div>
          <button
            className="logout-button"
            onClick={logout}
            aria-label="Cerrar sesión"
          >
            <LogOut size={15} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
}
