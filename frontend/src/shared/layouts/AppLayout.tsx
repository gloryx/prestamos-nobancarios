import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '@/shared/components/Header'
import { Sidebar } from '@/shared/components/Sidebar'

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return <div className="app-shell"><Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} /><div className="main-shell"><Header onMenu={() => setMobileOpen(true)} /><main className="content"><Outlet /></main></div></div>
}
