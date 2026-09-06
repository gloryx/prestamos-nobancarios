import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/shared/components/Sidebar'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className="app-shell"><Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} /><button className="icon-button mobile-menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={21} /></button><div className="main-shell"><main className="content"><Outlet /></main></div></div>
}
