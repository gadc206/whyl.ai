import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../App';

export default function Layout() {
  const { user, logout } = useAuth();
  const isAdvertiser = user?.role === 'advertiser';

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">whyl<span className="accent">(</span>ai<span className="accent">)</span></div>
        <p>{isAdvertiser ? 'Advertise during AI waits.' : 'While AI thinks, you earn.'}</p>
        <nav>
          {!isAdvertiser && (
            <>
              <NavLink to="/">Dashboard</NavLink>
              <NavLink to="/earnings">Earnings</NavLink>
              <NavLink to="/referrals">Referrals</NavLink>
              <NavLink to="/history">History</NavLink>
            </>
          )}
          <NavLink to="/advertiser">Marketplace</NavLink>
          {isAdvertiser && <NavLink to="/campaigns">Campaigns</NavLink>}
        </nav>
        {!isAdvertiser && (
          <p className="note sidebar-note">
            Want to advertise too? Open Marketplace anytime — earners can fund campaigns from profile later.
          </p>
        )}
        <div className="account">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
          {user?.company && <span>{user.company}</span>}
          <span className="role-pill">{isAdvertiser ? 'Advertiser' : 'Earner'}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
