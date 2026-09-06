import { ChevronDown, ChevronRight, LogOut, WalletMinimal, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/app/providers/auth-context";
import {
  isGroup,
  navigation,
  type NavGroup,
  type NavItem,
} from "@/config/navigation";

export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const initials = user?.nombreCompleto
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const visibleNavigation = user?.rol === 'VENDEDOR' ? navigation.map((item) => item.label === 'Configuración' && isGroup(item) ? { ...item, items: item.items.filter((child) => child.label === 'Formas de pago' || child.label === 'Periodicidades') } : item) : navigation;
  const [expanded, setExpanded] = useState<string | null>("Clientes");
  const toggle = (key: string) =>
    setExpanded((current) => (current === key ? null : key));
  return (
    <>
      <div
        className={`sidebar-overlay ${mobileOpen ? "visible" : ""}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <WalletMinimal size={22} />
          </div>
          <div>
            <strong>
              Finan<span>za</span>
            </strong>
            <small>Operación inteligente</small>
          </div>
          <button
            className="icon-button close-menu"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {visibleNavigation.map((item) =>
            isGroup(item) ? (
              <Group
                key={item.label}
                group={item}
                pathKey={item.label}
                expanded={expanded}
                onToggle={toggle}
                onClose={onClose}
              />
            ) : (
              <Link key={item.path} item={item} onClick={onClose} />
            ),
          )}
        </nav>
        <div className="sidebar-account">
          <div className="sidebar-account-info">
            <div className="sidebar-avatar" aria-hidden="true">{initials}</div>
            <div className="sidebar-account-details">
              <strong title={user?.nombreCompleto}>{user?.nombreCompleto}</strong>
              <span>{user?.rol}</span>
            </div>
          </div>
          <button className="sidebar-logout" onClick={logout}>
            <LogOut size={15} />
            <span>Cerrar sesión</span>
          </button>
        </div>
        <div className="sidebar-footer">
          <div className="status-dot" />
          <span>Desarrolado por gloryx</span>
        </div>
      </aside>
    </>
  );
}
function Group({
  group,
  pathKey,
  expanded,
  onToggle,
  onClose,
}: {
  group: NavGroup;
  pathKey: string;
  expanded: string | null;
  onToggle: (key: string) => void;
  onClose: () => void;
}) {
  const Icon = group.icon;
  const isOpen = expanded === pathKey || expanded?.startsWith(`${pathKey}/`);
  return (
    <div className="nav-group">
      <button
        className="nav-group-toggle"
        onClick={() => onToggle(pathKey)}
        aria-expanded={isOpen}
      >
        <Icon size={17} />
        <span>{group.label}</span>
        {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {isOpen && (
        <div className="submenu">
          {group.items.map((item) =>
            isGroup(item) ? (
              <Group
                key={item.label}
                group={item}
                pathKey={`${pathKey}/${item.label}`}
                expanded={expanded}
                onToggle={onToggle}
                onClose={onClose}
              />
            ) : (
              <span key={item.path}>
                {item.separatorBefore && <span className="separator" />}
                <Link item={item} onClick={onClose} />
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
function Link({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
      className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
    >
      {Icon && <Icon size={15} />}
      <span>{item.label}</span>
    </NavLink>
  );
}
