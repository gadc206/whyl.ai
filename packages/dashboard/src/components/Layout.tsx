import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../App';

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside>
        <div className="brand">WHYL</div>
        <p>While AI thinks, you earn.</p>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/earnings">Earnings</NavLink>
          <NavLink to="/referrals">Referrals</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/advertiser">Advertiser</NavLink>
        </nav>
        <div className="account">
          <strong>{user?.name}</strong>
          <span>{user?.email}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </aside>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
