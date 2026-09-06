import '../Style/pages/navbar.scss';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store';
import { logout } from '../features/auth/authSlice';
import type { RootState } from '../store/store';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu';
import { useEffect, useState } from 'react';
import { ROUTES } from '../constants/routes';

const Navbar = () => {
    const location = useLocation();
    const currentpath = location.pathname;
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const [isAdmin, setIsAdmin] = useState(false);

    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    const user = useSelector((state: RootState) => state.auth.user);
    // Use 'any' to avoid linter error for permission_id property

    useEffect(() => {
        if (user && (user as any).permission_id === 1) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    const handleLogout = () => {
        dispatch(logout());
        navigate(ROUTES.SIGN_IN);
    };

    return (
        <nav className="navbar">
            <div className="container">
                <div className="navbar-brand">
                    <span onClick={() => navigate(ROUTES.HOME)}>Fulda Bazaar</span>
                </div>
                <div className="navbar-links">
                    {isAuthenticated && (
                        <>
                            <Link to={ROUTES.APP}>Home</Link>
                            <Link to={ROUTES.CREATE_LISTING}>Create Add</Link>
                        </>
                    )}
                    {isAuthenticated ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className="navbar-user-btn">My Account ▾</button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>{user?.first_name} {user?.last_name}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => navigate(ROUTES.PROFILE)}>Profile</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => navigate(ROUTES.MESSAGES)}>Messages</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => navigate(ROUTES.WATCHLIST)}>Watchlist</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => navigate(ROUTES.MY_ADDS)}>My Adds</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => navigate(ROUTES.TRANSACTIONS)}>Transactions</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => navigate(ROUTES.LANGUAGE_PARTNER)}>Language Partner</DropdownMenuItem>
                                {isAdmin && <DropdownMenuItem onSelect={() => navigate(ROUTES.ADMIN)}>Admin Dashboard</DropdownMenuItem>}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={handleLogout}>Sign Out</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <div className="auth-nav-links">
                            {currentpath === ROUTES.SIGN_IN ? (
                                <Link to={ROUTES.SIGN_UP} className="signup-link-button">Sign Up</Link>
                            ) : currentpath === ROUTES.SIGN_UP ? (
                                <Link to={ROUTES.SIGN_IN} className="signin-link-button">Sign In</Link>
                            ) : (
                                <>
                                    <Link to={ROUTES.SIGN_IN} className="signin-link">Sign In</Link>
                                    <Link to={ROUTES.SIGN_UP} className="signup-link-button">Sign Up</Link>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;

