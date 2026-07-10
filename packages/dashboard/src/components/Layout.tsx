import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../App';

export default function Layout() {
  const { user, logout } = useAuth();
  const isAdvertiser = user?.role === 'advertiser';

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">WHYL</div>
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
          {isAdvertiser && <NavLink to="/advertiser">Campaigns</NavLink>}
          {!isAdvertiser && <NavLink to="/advertiser">Advertiser</NavLink>}
        </nav>
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
