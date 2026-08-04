import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../routes/AuthContext';
import { Avatar } from './Avatar';

const NAV_ITEMS = [
  { to: '/', end: true, icon: 'shield-lock', label: 'Admin Overview' },
  { to: '/approvals', end: false, icon: 'checklist', label: 'Service Hour Approvals' },
  { to: '/chapters', end: false, icon: 'building-community', label: 'Chapters' },
  { to: '/members', end: false, icon: 'affiliate', label: 'Members & Demographics' },
  { to: '/impact', end: false, icon: 'chart-dots', label: 'Impact Measurables' },
  { to: '/mentorship', end: false, icon: 'school', label: 'Mentorship' },
  { to: '/resources', end: false, icon: 'books', label: 'Resources Manager' },
  { to: '/partners', end: false, icon: 'handshake', label: 'Program Partners' },
  { to: '/form-submissions', end: false, icon: 'forms', label: 'Form Submissions' },
];

export function Sidebar() {
  const admin = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="w-[230px] min-w-[230px] max-portal:w-[60px] max-portal:min-w-[60px] bg-sidebar flex flex-col overflow-y-auto">
      <div className="px-5 pt-[22px] pb-[18px] max-portal:justify-center max-portal:py-[18px] max-portal:px-0 font-heading text-[17px] text-white tracking-[0.1em] border-b border-white/10 flex items-center gap-[9px]">
        <div className="w-[9px] h-[9px] bg-accent rounded-full shrink-0" />
        <span className="max-portal:hidden">CAREFORALL</span>
      </div>

      <div className="px-5 py-4 max-portal:justify-center max-portal:py-[14px] max-portal:px-0 border-b border-white/10 flex items-center gap-[11px]">
        <Avatar initial={admin?.initial ?? 'A'} />
        <div className="max-portal:hidden">
          <div className="text-[13px] font-medium text-white leading-[1.3]">{admin?.fullName ?? ''}</div>
          <div className="text-[11px] text-white/50 mt-px">Admin</div>
        </div>
      </div>

      <nav className="flex-1 py-[10px]">
        <div className="px-5 pt-1 pb-2 max-portal:hidden text-[10px] font-semibold text-white/35 uppercase tracking-[0.1em]">
          Admin
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-[10px] px-5 py-[10px] max-portal:justify-center max-portal:px-0 max-portal:py-3 text-[11.5px] font-medium cursor-pointer transition-colors duration-150 tracking-[0.05em] uppercase border-l-[3px] select-none ${
                isActive
                  ? 'bg-white/14 text-white border-l-accent'
                  : 'text-white/60 border-l-transparent hover:bg-white/7 hover:text-white/90'
              }`
            }
          >
            <i className={`ti ti-${item.icon} text-[17px] shrink-0`} />
            <span className="max-portal:hidden">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div
        onClick={handleSignOut}
        className="px-5 py-[15px] max-portal:justify-center max-portal:px-0 max-portal:py-[14px] border-t border-white/10 flex items-center gap-[10px] text-white/40 text-[12px] cursor-pointer transition-colors duration-150 hover:text-white/70"
      >
        <i className="ti ti-logout" />
        <span className="max-portal:hidden">Sign Out</span>
      </div>
    </aside>
  );
}
