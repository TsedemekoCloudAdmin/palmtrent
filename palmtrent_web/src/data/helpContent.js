// PalmTrent platform User Guide content (web + mobile).
// Rendered by src/pages/HelpCenter.jsx (in-app help at /help).
// Kept in sync with palmtrent_mobile/src/data/helpContent.js.
// Each flow: { title, platforms: ['web'|'mobile'], steps: [..], result }

export const PLATFORMS = { web: 'Web', mobile: 'Mobile app' };

export const helpSections = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Accounts, sign-in, passwords and where each role lands.',
    flows: [
      {
        title: 'Register a new account',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the app and choose Get Started / Sign Up.',
          'Pick your account type: Shipper, Transporter, Rental Owner, Trailer Owner, Driver or Corporate. (Admins and Clerks are created by an administrator.)',
          'Enter full name, email, phone in +263 format, and a password of at least 8 characters.',
          'If phone verification is on, request the 6-digit SMS code and enter it.',
          'Submit to create the account.'
        ],
        result: 'Your account is created, you are signed in, and taken to your role home. If a paid plan is required you may be prompted to pay via ClicknPay.'
      },
      {
        title: 'Sign in',
        platforms: ['web', 'mobile'],
        steps: ['Choose Sign In.', 'Enter your email and password.', 'Submit.'],
        result: 'You land on your role home. If you were issued a temporary password you must change it first.'
      },
      {
        title: 'Forgot / reset password',
        platforms: ['web', 'mobile'],
        steps: [
          'On the login screen choose Forgot password and enter your email.',
          'Open the reset link sent to your email.',
          'Enter and confirm a new password, then submit.'
        ],
        result: 'Your password is reset and you can sign in again.'
      },
      {
        title: 'First-login password change (invited staff/drivers/team)',
        platforms: ['web', 'mobile'],
        steps: [
          'Sign in with the temporary password you received by SMS.',
          'Enter the temporary password, then a new password and confirm it.',
          'Update the password.'
        ],
        result: 'Your own password is set and you continue into the app.'
      },
      {
        title: 'Find your way around (mobile tabs)',
        platforms: ['mobile'],
        steps: [
          'Shipper/Corporate: Home · Tracking · History · Profile.',
          'Transporter: Home · Jobs · SOS · Fleet · Drivers · Profile.',
          'Trailer/Rental owner: Home · Fleet · Market · Rentals · Staff · Drivers · Profile.',
          'Driver: Deliveries · Work · Progress · Alerts · Profile.',
          'Roadside responder: SOS · Alerts · Profile.',
          'Clerk/Agent: Desk · Arrivals · Scan · Profile.'
        ],
        result: 'Each role has its own bottom tabs; the Home screen shows quick actions for your role.'
      },
      {
        title: 'Log out',
        platforms: ['web', 'mobile'],
        steps: ['Open the user menu (web: top-right avatar; mobile: Profile tab).', 'Choose Logout / Sign Out.'],
        result: 'Your session ends and you return to the sign-in screen.'
      }
    ]
  },

  {
    id: 'shipper',
    title: 'Shipper',
    summary: 'Book transport, pay, track, rate, and review history.',
    flows: [
      {
        title: 'Create a booking (mobile)',
        platforms: ['mobile'],
        steps: [
          'On Home tap Book Transport.',
          'Choose cargo type, enter weight and value; toggle insurance and pick a plan if wanted.',
          'Enter pickup and delivery locations and the pickup date/time.',
          'Review the calculated price, then tap to continue to payment.'
        ],
        result: 'A booking is prepared and you move to the payment screen.'
      },
      {
        title: 'Create a booking (web)',
        platforms: ['web'],
        steps: [
          'Open New Booking.',
          'Step through Locations → Cargo & Vehicle (+ optional insurance) → Schedule.',
          'Tap Get Quote, review the breakdown, then Pay with ClicknPay.'
        ],
        result: 'A booking is created with a reference and moves to "finding a transporter".'
      },
      {
        title: 'Pay for a booking (mobile)',
        platforms: ['mobile'],
        steps: [
          'On the review screen pick a payment method: Mobile Money (EcoCash/OneMoney/ClicknPay), Card, or Cash via Agent.',
          'Mobile Money: confirm your phone and approve the USSD/app prompt — the screen polls until confirmed.',
          'Card: complete the hosted checkout that opens.',
          'Cash via Agent: share the agent code; it confirms once the agent collects.'
        ],
        result: 'On confirmation the booking is paid and released for transporter matching; you reach the confirmation screen.'
      },
      {
        title: 'Cross-border booking',
        platforms: ['web', 'mobile'],
        steps: [
          'Start a booking and select the destination country.',
          'Upload the required cross-border documents.',
          'Review the price (includes border surcharge and insurance).'
        ],
        result: 'A cross-border booking is created with the correct documentation and pricing.'
      },
      {
        title: 'Track a shipment',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the Tracking tab (mobile) or Track Shipments (web).',
          'Select the shipment.'
        ],
        result: 'You see the live map, status timeline (assigned → picked up → in transit → delivered), ETA, recent events, and the driver with a call button. Updates stream live when connected.'
      },
      {
        title: 'View booking history',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the History tab (mobile) or My Bookings (web).',
          'Filter by status (All / In Transit / Delivered / Cancelled).',
          'Open a booking for details; download the Proof-of-Delivery for delivered jobs (web).'
        ],
        result: 'A complete, filterable record of your shipments.'
      },
      {
        title: 'Rate a delivery',
        platforms: ['web', 'mobile'],
        steps: [
          'After delivery open the rating screen.',
          'Give an overall 1–5 star rating and rate categories (communication, punctuality, handling, etc.).',
          'Add tags/comments and a "would use again" choice, then submit.'
        ],
        result: 'Your rating is recorded against the transporter and shown in their profile.'
      }
    ]
  },

  {
    id: 'rentals-shipper',
    title: 'Renting & courier',
    summary: 'Hire vehicles/trailers and track goods sent by bus through an agent.',
    flows: [
      {
        title: 'Rent a vehicle or trailer',
        platforms: ['web', 'mobile'],
        steps: [
          'Open Rent a Vehicle / Rent a Trailer.',
          'Set the rental dates and browse available assets.',
          'Select an asset and submit a rental request.'
        ],
        result: 'A rental request is sent to the owner for approval; track it under My Rentals.'
      },
      {
        title: 'Manage your rentals',
        platforms: ['web', 'mobile'],
        steps: [
          'Open My Rentals.',
          'When approved, pay for the rental (a payment link/checkout opens).',
          'At handover and return, complete the inspection if prompted.'
        ],
        result: 'Your rental progresses request → approved → paid → picked up → returned.'
      },
      {
        title: 'Track courier (bus) shipments',
        platforms: ['mobile'],
        steps: [
          'Open "My Courier Shipments" from the Home screen.',
          'Tap a shipment to see its tracking timeline.',
          'Optionally share it with another app user or add an extra SMS contact.'
        ],
        result: 'You follow goods sent through a PalmTrent depot agent, end to end, with notifications.'
      }
    ]
  },

  {
    id: 'corporate',
    title: 'Corporate',
    summary: 'Company bookings, team, analytics, billing, reports and settings.',
    flows: [
      {
        title: 'Invite & manage team members',
        platforms: ['web', 'mobile'],
        steps: [
          'Mobile: Home → Manage Team → add a member with name/email/phone and role.',
          'Web: Team Members → Add Member; enter name, email, phone, role (Viewer/Manager/Admin) and permissions, then Send Invitation.',
          'Edit a member to change role/permissions, or remove them.'
        ],
        result: 'New members get a login and a temporary password (shown on screen and by SMS) and must set their own password on first login.'
      },
      {
        title: 'Bookings, analytics, billing & reports',
        platforms: ['web'],
        steps: [
          'Manage Bookings: create (opens the shipper workflow), filter, view, track, export CSV.',
          'Analytics: totals, booking-status and spend charts, monthly summary.',
          'Billing: subscription/charges/credit, change payment method, download invoices, pay via ClicknPay.',
          'Reports: Generate (CSV) or Schedule monthly.'
        ],
        result: 'Company spend and activity are analysed, invoiced and reportable.'
      },
      {
        title: 'Company settings & API key',
        platforms: ['web'],
        steps: [
          'Settings → edit company profile and notification preferences, then Save.',
          'API Access → Copy or Regenerate the corporate API key, or open the API documentation.'
        ],
        result: 'Company details are saved and API integration credentials are managed.'
      }
    ]
  },

  {
    id: 'transporter',
    title: 'Transporter',
    summary: 'Find & accept jobs, run pickup/delivery, manage fleet, earnings and verification.',
    flows: [
      {
        title: 'Find and accept a job',
        platforms: ['mobile', 'web'],
        steps: [
          'Open the Jobs / Available Jobs view (filter by Recommended / Today / High pay).',
          'Open a job to see route, cargo, shipper rating, schedule and payout.',
          'Select the vehicle to use, complete the pre-acceptance checklist, and Accept the job.'
        ],
        result: 'The job is assigned to you and a shipment is created; it appears in active deliveries.'
      },
      {
        title: 'Pickup checklist',
        platforms: ['mobile'],
        steps: [
          'Tap "I\'ve arrived at pickup" to check in.',
          'Verify the goods match the description.',
          'Take the required photos (min 3).',
          'Capture the shipper signature, then Complete Pickup.'
        ],
        result: 'Pickup is confirmed with photo + signature proof; the shipment advances to "picked up / in transit".'
      },
      {
        title: 'Delivery checklist',
        platforms: ['mobile'],
        steps: [
          'Check in at the delivery location and verify the recipient.',
          'Offload and inspect the cargo; take delivery photos.',
          'If cash-on-delivery, mark cash collected.',
          'Capture the recipient signature, then Complete Delivery.'
        ],
        result: 'Delivery is confirmed; your earnings are scheduled for release (typically 24h later).'
      },
      {
        title: 'Manage fleet & drivers',
        platforms: ['mobile', 'web'],
        steps: [
          'Open Fleet management.',
          'Add a vehicle (registration, make/model, capacity, rates) and upload vehicle photos.',
          'Add drivers and assign a driver to a vehicle (or hire from the Driver Marketplace).',
          'Assign a specific vehicle to a shipment from the job details.'
        ],
        result: 'Your vehicles and drivers are registered, paired, and assignable to jobs.'
      },
      {
        title: 'Earnings & withdrawals',
        platforms: ['mobile'],
        steps: [
          'Open My Earnings; switch between Week / Month / All time.',
          'Set your payout method (EcoCash / OneMoney / Bank) and account details.',
          'Request a withdrawal of your available balance.'
        ],
        result: 'Earnings are tracked and a withdrawal request is queued for payout.'
      },
      {
        title: 'Get verified (KYC)',
        platforms: ['mobile'],
        steps: [
          'Open Transporter Verification.',
          'Enter personal info; upload national ID, driver licence (with classes and expiry); take a selfie.',
          'Review and submit for verification.'
        ],
        result: 'Your documents go to an admin for review; once approved you can accept jobs.'
      },
      {
        title: 'Trigger an SOS',
        platforms: ['mobile'],
        steps: [
          'Tap the SOS button.',
          'Select the emergency type (accident, breakdown, hijacking, medical, etc.).',
          'Confirm — your GPS location is captured and support is alerted.'
        ],
        result: 'An emergency is logged, support is contacted, a responder can be dispatched, and counterparties are notified.'
      }
    ]
  },

  {
    id: 'driver',
    title: 'Driver',
    summary: 'Set availability, run assigned deliveries, track, chat and SOS.',
    flows: [
      {
        title: 'Set availability & marketplace profile',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the driver workspace / availability screen (Work tab on mobile).',
          'Complete your profile (licence, experience, preferred areas, expected rate).',
          'Toggle "show me in search", "looking for work" and "available now".',
          'If your annual subscription is unpaid, pay it (ClicknPay).'
        ],
        result: 'You appear in the driver marketplace (once the subscription is paid) and can be hired.'
      },
      {
        title: 'Run an assigned delivery',
        platforms: ['mobile'],
        steps: [
          'Open the Deliveries tab and pick the assigned shipment.',
          'Start pickup trip → confirm pickup (checklist) → start transit → arrived at delivery → confirm delivery (checklist).',
          'Share your live location so the transporter and shipper can track you.'
        ],
        result: 'The shipment moves through its lifecycle with live tracking and proof-of-delivery captured.'
      },
      {
        title: 'Chat & SOS',
        platforms: ['mobile'],
        steps: ['Open the chat on a booking to message the transporter or shipper.', 'Use the SOS button in an emergency.'],
        result: 'You stay in contact during the trip and can raise emergencies.'
      }
    ]
  },

  {
    id: 'fleet-owner',
    title: 'Trailer / Rental Owner',
    summary: 'List assets, run the rental marketplace, handovers, staff and maintenance.',
    flows: [
      {
        title: 'Register / add a fleet asset',
        platforms: ['web', 'mobile'],
        steps: [
          'Mobile: open the asset/trailer registration form (owner info → asset details & photos → rental terms → payment & insurance).',
          'Web: Fleet → + Add Fleet; choose asset type and fill registration, type, make/model, rates, city and availability.'
        ],
        result: 'The asset is added to your fleet and (if enabled) listed on the rental marketplace.'
      },
      {
        title: 'Handle rental requests',
        platforms: ['web', 'mobile'],
        steps: [
          'Open Rentals.',
          'Approve or reject incoming requests.',
          'For approved rentals, create the payment link and check payment.',
          'Create walk-in rentals for customers at your desk (cash or online).'
        ],
        result: 'Rentals progress request → approved → paid → active, with walk-ins captured on the spot.'
      },
      {
        title: 'Rental collection & return inspection',
        platforms: ['web', 'mobile'],
        steps: [
          'On a confirmed rental tap Confirm Pickup; record odometer, fuel, photos and a signature.',
          'On return tap Confirm Return; record condition, damage, and any damage/cleaning/late/extra-km fees.'
        ],
        result: 'Pickup and return are documented with photos and signatures, and the settlement is updated.'
      },
      {
        title: 'Manage rental staff',
        platforms: ['web', 'mobile'],
        steps: [
          'Open Staff → Add staff.',
          'Enter name, email, phone, a temporary password and a role: Manager (full), Agent (rentals only) or Viewer (read-only).'
        ],
        result: 'The staff member can sign in (changing their password first) and act within their role\'s permissions.'
      },
      {
        title: 'Maintenance / service log',
        platforms: ['web', 'mobile'],
        steps: [
          'Open an asset and choose Service Log.',
          'Add a record: type, description, cost, odometer and who performed it.'
        ],
        result: 'A maintenance history is kept against the asset.'
      }
    ]
  },

  {
    id: 'responder',
    title: 'Roadside Responder',
    summary: 'Go online, quote, dispatch and complete emergency jobs.',
    flows: [
      {
        title: 'Respond to an SOS',
        platforms: ['mobile'],
        steps: [
          'Complete your responder profile (services, vehicle, service radius) and toggle availability on.',
          'When an SOS arrives, submit a quote (price; distance for towing).',
          'Once approved, Accept, mark On Scene, then Complete.'
        ],
        result: 'The emergency is handled end to end and you are paid through the platform.'
      }
    ]
  },

  {
    id: 'courier',
    title: 'Courier Desk (Clerk / Agent)',
    summary: 'Depot bus-courier: capture, label, load, arrive, collect/deliver.',
    flows: [
      {
        title: 'Create a courier shipment',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the Courier Desk and choose New Shipment.',
          'Enter route (depot or free-text), sender and recipient, and the items (weight drives the price).',
          'Choose collect-at-depot or deliver-to-address; collect payment at the counter.',
          'Create the shipment.'
        ],
        result: 'A shipment with a CR- reference and QR label is created; sender and recipient are notified.'
      },
      {
        title: 'Print labels (one per item)',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the shipment label.',
          'Set the number of copies (defaults to the item count).',
          'Print via the print dialog, Download ZPL, or Send to a networked Zebra printer.'
        ],
        result: 'Large, bold labels print — stick one on every item.'
      },
      {
        title: 'Move a shipment through its stages',
        platforms: ['web', 'mobile'],
        steps: [
          'Mark Loaded on bus → In Transit.',
          'At the destination depot, Scan Arrival (use the Scan tab on mobile).',
          'Collection: Record Collection — capture the collector\'s name + ID (and optional ID/face photo).',
          'Delivery: on arrival it is broadcast to transporters for last-mile delivery.'
        ],
        result: 'The shipment reaches Collected or Delivered, with the sender/recipient notified at each step.'
      },
      {
        title: 'Daily reconciliation & arrivals',
        platforms: ['web', 'mobile'],
        steps: [
          'Use the "My day" view for the shipments you booked today and the cash collected/outstanding.',
          'Use the Arrivals tab to process shipments inbound to your depot.'
        ],
        result: 'End-of-shift cash totals are clear and arrivals are easy to find.'
      }
    ]
  },

  {
    id: 'admin',
    title: 'Administrator',
    summary: 'Users, verifications, jobs, payments, rentals, monetization, disputes, SOS, support.',
    flows: [
      {
        title: 'Create a Clerk / Admin account',
        platforms: ['web'],
        steps: [
          'Open Users → + Add Admin/Clerk.',
          'Enter name, email, mobile (+263) and a temporary password.',
          'Set Platform Access to Clerk (or Administrator), then Create User.'
        ],
        result: 'The staff account is created. A Clerk signs in and lands on the Courier Desk.'
      },
      {
        title: 'Verify users',
        platforms: ['web'],
        steps: [
          'Open Verifications (or a user\'s detail in Users).',
          'Review documents and run authority checks (authority, method, result, reference, expiry, notes).',
          'Approve or reject the verification.'
        ],
        result: 'The account\'s verification status updates with a full audit trail.'
      },
      {
        title: 'Oversee jobs, payments, rentals & monetization',
        platforms: ['web'],
        steps: [
          'Jobs: view any job incl. the earnings split (transporter / insurance / platform) and tracking.',
          'Payments: verify cash-agent payments, run EcoCash reconciliation, export.',
          'Rentals: confirm payment, extend, cancel, dispute or settle.',
          'Monetization: build plans, commission rules, subscriptions and payouts.'
        ],
        result: 'Operational records and pricing are monitored and configured from one console.'
      },
      {
        title: 'Disputes, SOS & support',
        platforms: ['web'],
        steps: [
          'Disputes: open a dispute, enter a resolution and outcome, set any refund, and submit.',
          'SOS: acknowledge / dispatch / resolve emergencies and approve roadside providers.',
          'Support: change ticket status and reply to customers.'
        ],
        result: 'Issues are resolved and customers receive responses, all logged.'
      }
    ]
  },

  {
    id: 'shared',
    title: 'Notifications, chat & profile',
    summary: 'Shared tools across the app.',
    flows: [
      {
        title: 'Notifications & push',
        platforms: ['web', 'mobile'],
        steps: [
          'Open the bell (web) or the Alerts/Notifications screen (mobile).',
          'Filter unread and Mark all read.',
          'On mobile, tapping a push notification opens the relevant shipment/job screen.'
        ],
        result: 'You stay informed of every status change.'
      },
      {
        title: 'Chat',
        platforms: ['web', 'mobile'],
        steps: ['Open the chat on a booking/rental.', 'Type and send; messages sync in real time.'],
        result: 'You communicate with the other party without leaving the platform.'
      },
      {
        title: 'Profile & password',
        platforms: ['web', 'mobile'],
        steps: [
          'Open Profile / Account.',
          'Edit name, email, phone (+263), company and address; save.',
          'Change your password from the same screen.'
        ],
        result: 'Your details and security are kept current.'
      }
    ]
  }
];
