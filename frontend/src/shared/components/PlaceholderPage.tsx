import { Construction } from "lucide-react";
import { useLocation } from "react-router-dom";
export function PlaceholderPage() {
  const location = useLocation();
  const title =
    location.pathname.split("/").filter(Boolean).pop()?.replaceAll("-", " ") ??
    "Módulo";
  return (
    <div className="placeholder">
      <Construction size={30} />
      <p className="eyebrow">MÓDULO EN PREPARACIÓN</p>
      <h1>{title.charAt(0).toUpperCase() + title.slice(1)}</h1>
      <p className="muted">
        Esta vista estará disponible en una próxima versión.
      </p>
    </div>
  );
}
