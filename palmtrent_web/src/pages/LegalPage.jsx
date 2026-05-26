import { Link, useLocation } from 'react-router-dom';

const LEGAL_COPY = {
  '/privacy': {
    title: 'Privacy Policy',
    intro: 'Palmtrent protects account, shipment, payment, and location data with role-based access controls and operational safeguards.',
    sections: [
      ['Data We Use', 'We collect profile details, booking records, payment references, compliance documents, and tracking events needed to operate the logistics marketplace.'],
      ['How It Is Used', 'Data is used to match shipments, process payments, provide support, meet compliance obligations, and improve service reliability.'],
      ['Your Choices', 'Users can update profile details from their account and contact support for access, correction, or account closure requests.']
    ]
  },
  '/terms': {
    title: 'Terms of Service',
    intro: 'These terms describe the operating rules for shippers, transporters, trailer owners, corporate users, and administrators on Palmtrent.',
    sections: [
      ['Marketplace Role', 'Palmtrent provides booking, payment, tracking, and fleet-rental tooling. Users remain responsible for accurate booking details and lawful transport activity.'],
      ['Payments And Delivery', 'Payments, escrow, releases, cancellations, and disputes are handled through the platform workflows and configured payment providers.'],
      ['Account Responsibilities', 'Users must keep credentials secure, provide accurate verification information, and use the platform without disrupting other users or services.']
    ]
  }
};

const LegalPage = () => {
  const { pathname } = useLocation();
  const content = LEGAL_COPY[pathname] || LEGAL_COPY['/terms'];

  return (
    <main className="legal-page">
      <section className="legal-panel">
        <Link className="public-tracking-back" to="/home">Back to Palmtrent</Link>
        <p className="eyebrow">Palmtrent</p>
        <h1>{content.title}</h1>
        <p className="legal-intro">{content.intro}</p>
        <div className="legal-sections">
          {content.sections.map(([title, body]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
};

export default LegalPage;
