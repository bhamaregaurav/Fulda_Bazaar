import './App.css';
import LandingPage from './Components/LandingPage';
import Navbar from './Components/Navbar';
import { Signin } from './Components/Signin';
import { TwoFAVerify } from './Components/TwoFAVerify';
import { TwoFASetup } from './Components/TwoFASetup';

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Signup } from './Components/Signup';
import { ForgotPassword } from './Components/ForgotPassword';
import { MainPage } from './Components/MainPage';
import { Messages } from './Components/Messages';
import { PrivateRoute } from './Components/shared/PrivateRoute';
import { ParallaxProvider } from 'react-scroll-parallax';
import { ListingDetailPage } from './Components/ListingDetailPage';
import { ListingCreatePage } from './Components/ListingCreatePage';
import { ProfilePage } from './Components/ProfilePage';
import { MyAddsPage } from './Components/MyAddsPage';
import AdminDashboard from './Components/AdminDashboard';
import AdminRoute from './Components/shared/AdminRoute';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { fetchUserProfile } from './features/auth/authSlice';
import type { RootState } from './store/store';
import { useAppDispatch } from './store';
import { ROUTES } from './constants/routes';
import { WatchlistPage } from './Components/WatchlistPage';
import { TransactionsPage } from './Components/TransactionsPage';
import PublicProfilePage from './Components/PublicProfilePage';
import LanguagePartner from './Components/LanguagePartner';
import LanguagePartnerCallV2 from './Components/LanguagePartnerCallV2';

function App() {
  const dispatch = useAppDispatch();
  const { token, user } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (token && !user) {
      dispatch(fetchUserProfile());
    }
  }, [token, user, dispatch]);

  return (
    <BrowserRouter>
      <ParallaxProvider>
        <Navbar />
        <Routes>
          <Route path={ROUTES.HOME} element={<LandingPage />} />
          <Route path={ROUTES.SIGN_IN} element={<Signin />} />
          <Route path={ROUTES.SIGN_UP} element={<Signup />} />
          <Route path={ROUTES.FORGOT_PASSWORD} element={<ForgotPassword />} />
          <Route path={ROUTES.TWO_FA_VERIFY} element={<TwoFAVerify />} />
          <Route
            path={ROUTES.TWO_FA_SETUP}
            element={
              <PrivateRoute>
                <TwoFASetup />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.APP}
            element={
              <PrivateRoute>
                <MainPage />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.MESSAGES}
            element={
              <PrivateRoute>
                <Messages />
              </PrivateRoute>
            }
          />
          <Route
            path={`${ROUTES.LISTING_DETAIL}/:id`}
            element={
              <PrivateRoute>
                <ListingDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.CREATE_LISTING}
            element={
              <PrivateRoute>
                <ListingCreatePage />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.PROFILE}
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.MY_ADDS}
            element={
              <PrivateRoute>
                <MyAddsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/watchlist"
            element={
              <PrivateRoute>
                <WatchlistPage />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.TRANSACTIONS}
            element={
              <PrivateRoute>
                <TransactionsPage />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.ADMIN}
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/profile/:userId"
            element={<PublicProfilePage />}
          />
          <Route
            path={ROUTES.LANGUAGE_PARTNER}
            element={
              <PrivateRoute>
                <LanguagePartner />
              </PrivateRoute>
            }
          />
          <Route
            path={ROUTES.LANGUAGE_PARTNER_CALL}
            element={
              <PrivateRoute>
                <LanguagePartnerCallV2 />
              </PrivateRoute>
            }
          />
        </Routes>
      </ParallaxProvider>
    </BrowserRouter>
  );
}

export default App;
