import '../Style/pages/landing-page.scss';
import { Tilt } from 'react-tilt';
import { Link } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

import {Footer} from './shared/Footer.tsx';
import { GuestListingGrid } from './GuestListingGrid.tsx';

const LandingPage = () => {

  return (
    <div className="page-container">
      <section className="landing-page">

        <h1 className="title">Fulda Bazaar</h1>
        <span className="subtitle">Your one-stop shop for everything!</span>
        
        <div className="tilt-wrapper">
          <Tilt
            className="get-started-tilt"
            tiltMaxAngleX={35}
            tiltMaxAngleY={35}
            scale={1.05}
          >
            <button className="get-started">
              <Link to={ROUTES.SIGN_IN}>Get Started →</Link>
            </button>
          </Tilt>
        </div>
      </section>

      <section className="details-page">
        <GuestListingGrid />
      </section>
      <Footer />
    </div>
  );
};

export default LandingPage;
