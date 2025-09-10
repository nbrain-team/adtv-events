import { NavLink, Outlet } from 'react-router-dom';
import { Toasts } from './Toasts';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/inbox', label: 'Inbox' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/templates', label: 'Funnel Templates' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/leads', label: 'Leads' },
  { to: '/settings', label: 'Settings' },
];

export function AppLayout() {
  return (
    <div className="min-h-screen">
      <Toasts />
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded bg-primary-600" />
            <span className="font-extrabold text-gray-900">ADTV Event Marketing</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `py-2 hover:text-primary-700 ${isActive ? 'text-primary-700 font-semibold' : 'text-gray-600'}`
                }
                end={item.to === '/'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      <footer className="border-t py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} ADTV. Static prototype for review.
      </footer>
    </div>
  );
}


