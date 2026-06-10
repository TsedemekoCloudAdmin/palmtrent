# PalmTrent — Platform User Guide (Web & Mobile)

A catalogued, step-by-step guide to every flow on the PalmTrent platform. Each procedure lists **where to click/tap → what to enter → ✅ the end result** you should see.

> **In-app version:** this guide is also available **inside the web app** at **`/help`** (the floating **? Help** button on every page opens it). It has a Web/Mobile filter and search. Sections 1–9 below detail the **web** pages; **section 11** summarises the **mobile** app flows.

---

## Table of Contents

1. [Getting Started (everyone)](#1-getting-started-everyone)
2. [Roles & where each one lands](#2-roles--where-each-one-lands)
3. [Shipper Portal — `/shipper`](#3-shipper-portal--shipper)
4. [Corporate Portal — `/corp`](#4-corporate-portal--corp)
5. [Fleet & Rentals Portal — `/fleet`](#5-fleet--rentals-portal--fleet)
6. [Driver Portal — `/fleet` (driver view)](#6-driver-portal--fleet-driver-view)
7. [Courier Desk — `/courier` (clerks/agents)](#7-courier-desk--courier-clerksagents)
8. [Admin Console — `/admin`](#8-admin-console--admin)
9. [Public & Utility Pages](#9-public--utility-pages)
10. [Appendix: conventions](#10-appendix-conventions)

---

## 1. Getting Started (everyone)

### 1.1 Register a new account
1. On the landing page, click **Get Started** (or **Sign Up** inside the login box).
2. Choose your account type: **Shipper, Transporter, Rental Owner, Trailer Owner, Driver, or Corporate**. *(Admins and Clerks are created by an administrator — see §8.2.)*
3. Fill in **Full Name, Email, Phone (+263 format), Password (min 8 chars), Confirm Password**.
4. If phone verification is enabled: click **Send Verification Code**, enter the 6‑digit SMS code, then **Verify & Create Account**. Otherwise click **Create Account**.
- ✅ **End result:** your account is created, you're logged in, and you're taken to your role's dashboard. (If a paid plan is required, you may be prompted to pay via ClicknPay.)

### 1.2 Log in
1. Click **Sign In**.
2. Enter **Email** and **Password** (use the eye icon to reveal). Optionally tick **Remember me**.
3. Click **Sign In**.
- ✅ **End result:** you land on your role dashboard. If your account was issued a temporary password, you're redirected to **Change Password** first (§1.4).

### 1.3 Forgot / reset password
1. In the login box click **Forgot password?**, enter your **email**, click **Send Reset Link**.
- ✅ **End result:** message: *"If an account with that email exists, a password reset link has been sent."*
2. Open the email link (`/reset-password`), enter **New password** + **Confirm password**, click **Reset Password**.
- ✅ **End result:** *"Password reset successfully"* — you're returned to the landing page to sign in.

### 1.4 First-login password change (invited staff/drivers/team)
Appears automatically when your account has a temporary password.
1. Enter **Temporary password**, **New password** (must differ), **Confirm new password**.
2. Click **Update Password**.
- ✅ **End result:** password updated; you proceed to your dashboard.

### 1.5 Log out
- Open the **user menu** (top-right avatar) → **Logout** (or **Sign Out** on fleet/courier pages).
- ✅ **End result:** session ends; you return to the landing page.

### 1.6 Notifications (corporate)
- The **bell icon** (top-right) shows an unread count; click it to see recent notifications and **Mark all read**.

---

## 2. Roles & where each one lands

| Account type | Lands on | Page |
|---|---|---|
| Shipper | `/shipper` | Shipper Portal |
| Corporate | `/corp` | Corporate Portal |
| Transporter / Trailer owner / Rental owner | `/fleet` | Fleet & Rentals Portal |
| Driver | `/fleet` | Driver view (availability) |
| Clerk / Agent | `/courier` | Courier Desk |
| Admin | `/admin` | Admin Console |

---

## 3. Shipper Portal — `/shipper`

**Sidebar:** Overview · New Booking · Track Shipments · My Bookings · Payments · Favorites · Reviews · Account.

### 3.1 Overview
- Shows stat cards (Active shipments, Completed, Total spent, Your rating), a **Create New Booking** banner, up to 3 active shipments, recent activity, and a recent-bookings table.
- **Track Live** on a card → opens Track Shipments. **View POD** (delivered jobs) → downloads the Proof-of-Delivery PDF.
- ✅ **End result:** an at-a-glance summary of your shipping activity.

### 3.2 Create a booking (New Booking)
A 5-step wizard:
1. **Locations** — pick **Pickup city** + address + contact phone, and **Delivery city** + address. Click **Continue**.
2. **Cargo & Vehicle** — choose **Cargo Type**, **Weight (tons)**, description; select a **Vehicle Type** (and optional **Trailer**). Optionally tick **Add cargo insurance**, enter cargo value + coverage, **Get Insurance Quotes**, and select a quote. Click **Continue**.
3. **Schedule** — choose **Pickup Date** and **Preferred Time**; review the booking summary. Click **Get Quote**.
- ✅ **End result of step 3:** a priced quote (base fare + insurance + platform fee + total, distance, time).
4. **Review & Pay** — review the breakdown, then click **Pay $[total] with ClicknPay**.
- ✅ **End result:** you're redirected to ClicknPay to pay by card/bank/EcoCash/OneMoney.
5. **Confirmation** — after payment you return to the app.
- ✅ **End result:** *"Booking Confirmed!"* with a **Booking Reference**; the platform begins finding a transporter. Use **Track Shipment** or **Create Another Booking**.

### 3.3 Track shipments
1. Open **Track Shipments**; use the **search box** to filter by ID/route.
2. Click a shipment in the left list.
- ✅ **End result (right panel):** live route status (current location, last-updated, progress %, ETA, speed when live), a route timeline (pickup → delivery), recent tracking events, and the assigned driver with a **Call** button. Live updates stream in when the tracking socket is connected.

### 3.4 My Bookings
- Filter tabs: **All / In Transit / Delivered / Cancelled**. **Export** downloads a CSV.
- Per row: **eye icon** → details modal (status, transporter, amount, cargo, addresses); **file icon** → download POD (delivered/completed only). Pagination at the bottom.
- ✅ **End result:** full, filterable history of your bookings.

### 3.5 Payments
- Stat cards (Total spent, Transactions, Preferred method) and a table of payments (reference, date, booking, method, amount, status).
- ✅ **End result:** a complete record of what you've paid.

### 3.6 Favorites
- Grid of favourite transporters. **Book Now** → starts a new booking; **phone icon** → calls them; **heart** → removes the favourite.

### 3.7 Reviews
- List of reviews you've left (driver, booking ref, stars, comment, date).

### 3.8 Account
1. Edit **Full Name, Email, Phone (+263), Company, Address, City, Province, Country**.
2. Click **Save Profile**.
- ✅ **End result:** *"Profile updated"*. The Session panel shows your sign-in and any subscription (with **Pay with ClicknPay** if payment is due) and a **Sign Out** button.

---

## 4. Corporate Portal — `/corp`

**Sidebar:** Overview · Manage Bookings · Team Members · Analytics · Billing · Reports · Settings. Top-right has a **notifications bell** and the **company menu**.

### 4.1 Overview
- Four stats (Active shipments, Completed, Total spend, On-time rate); quick actions (**New Booking / Add Team Member / Download Report**); **Recent Bookings**; **Top Routes** (bar chart); **Monthly Spending Trend**.
- ✅ **End result:** a company-wide shipping & spend dashboard.

### 4.2 Manage Bookings
- Filter by status (All / In Transit / Awaiting Pickup / Delivered / Cancelled). **Export** → CSV.
- **Eye icon** → booking details panel; **map-pin icon** → live tracking; **+ New Booking** → opens the shipper booking workflow.
- ✅ **End result:** view/track/export every company booking.

### 4.3 Team Members
1. Click **+ Add Member**.
2. Enter **Full Name, Email, Phone (+263), Role (Viewer/Manager/Admin)**, and tick **Permissions** (Create Bookings, View All Bookings, Manage Team, View Reports).
3. Click **Send Invitation**.
- ✅ **End result:** the member is created and added. If they were new, the screen shows their **login email + temporary password** (also SMS'd) — they'll be forced to set their own password on first login.
- **Edit** a card → change role/permissions → **Save Changes** (✅ *"…updated."*). **Remove** → confirm → ✅ *"…removed."*

### 4.4 Analytics
- Key metrics (Total bookings, Completed, Total spend, Avg order), a **Booking Status** bar chart, **Spending Distribution**, and a **Monthly Summary** table.
- ✅ **End result:** trends and breakdowns of corporate activity.

### 4.5 Billing
- Cards: Subscription (+ **Pay with ClicknPay** if due), Current month charges, Pending payments, Credit balance, Next billing date.
- **Payment method**: pick Monthly Invoice / Bank Transfer / Corporate Credit → **Update** (✅ *"Payment method updated."*).
- **Invoice history**: **download icon** → saves the invoice; **eye icon** → details panel; **Export All** → CSV; **Refresh** → reload.

### 4.6 Reports
- Four report types (Monthly Booking Summary, Spending Analysis, Team Activity, Route Efficiency).
- **Generate** → downloads a CSV and adds it to **Recent Downloads**. **Schedule** → ✅ *"…scheduled monthly."* and it appears under **Scheduled Reports**.

### 4.7 Settings
1. **Company Profile** — edit company name, registration #, contact, email, phone (+263), address → **Save Changes** (✅ *"Corporate settings saved."*).
2. **Notification Preferences** — toggle booking confirmations, delivery updates, invoice & team alerts.
3. **API Access** — **Copy** the API key, **Regenerate** (confirm; ✅ a new key is shown once), or **View API Documentation** (opens `/api-docs`).

---

## 5. Fleet & Rentals Portal — `/fleet`

For **transporters, trailer owners, and rental owners**. **Tabs:** Fleet · Drivers · Staff · Market · Rentals · Account. Top bar has **Refresh** and **Sign Out**, plus stat tiles (Assets, Trailers, Tractors, Rented, Rental value).

### 5.1 Fleet — add and manage assets
**Add an asset:**
1. Click **+ Add Fleet**.
2. Choose **Asset Type** (Small Vehicle / Trailer / Tractor Unit / Truck / Full Rig).
3. Fill **Registration Number** (required), Display Name; **Trailer Type** (trailers/rigs) and/or **Truck/Vehicle Type**; **Make & Model**; Year, Capacity (tonnes); **Daily Rate**, **Deposit**; **City**; **Rental Mode**; tick **Rent out** and/or **Shipment work**.
4. Click **Add Asset**.
- ✅ **End result:** *"Fleet asset added"* (or *"Small vehicle added"*); the asset appears in **My Fleet**.

**Manage an asset card:**
- **Open For Bookings** → status becomes *available* (✅ *"…is open for bookings."*).
- **Maintenance** → status becomes *maintenance*.
- **Service Log** (trailers/trucks) → opens the maintenance history; see 5.2.

### 5.2 Service Log (maintenance records)
1. On an asset, click **Service Log**.
2. In the dialog, view past records, then fill **Type, Description (required), Cost, Odometer, Performed by**.
3. Click **Add Maintenance Record**.
- ✅ **End result:** *"Maintenance record added"*; the record appears in the asset's history.

### 5.3 Drivers
**Add/Edit:** **+ Add Driver** (or **Edit**) → Full Name, Phone, Email, License Number/Class/Expiry, Experience, Employment Type, Notes → **Add/Save Driver** (✅ *"Driver added/updated"*).
**Per driver card:**
- **Assign / Change Vehicle** → pick a vehicle → **Assign Vehicle** (✅ *"Vehicle assigned to …"*). **Unassign** removes it.
- **Invite to App** (drivers with no login) → confirm → ✅ an app account is created and the **temporary password is shown + SMS'd**.
- **Available / On Leave** → sets status. **Delete** → confirm → removes the driver.

### 5.4 Staff (rental staff)
1. Click **+ Add Staff**.
2. Enter Full Name, Email, Mobile (+263), Temporary Password (min 8), and **Role**:
   - **Manager** — full access incl. add/edit staff, fleet, drivers, rentals.
   - **Agent** — manage rentals/walk-ins/inspections; cannot edit fleet or staff.
   - **Viewer** — read-only.
3. Click **Add Staff User**.
- ✅ **End result:** *"Staff user added"*; they can log in (forced to change password first) and act within their role's permissions.

### 5.5 Market (rent from others)
1. Set **Start/End date**, **Pickup/Return address** filters.
2. On an available asset, click **Request Rental**.
- ✅ **End result:** *"Rental request submitted"* — it goes to the owner for approval (tracked under **Rentals → Your Rental Requests**).

### 5.6 Rentals — approve, pay, pickup, return
**Incoming requests (for your assets):**
- **pending** → **Approve** / **Reject**.
- **approved** → **Create Payment Link** (✅ link opens in a new tab to share/pay).
- **payment_pending** → **Check Payment**.
- **confirmed** → **Confirm Pickup** (opens inspection).
- **active** → **Confirm Return** (opens inspection).

**Your requests (from other owners):** Pay Rental → Check Payment → Confirm Pickup → Confirm Return as the status advances.

**Walk-in rental:** **+ Walk-in Rental** → pick asset (+ optional driver), enter customer details, dates, addresses, **Payment Method** (cash/clicknpay), notes → **Create Rental** (✅ *"Walk-in rental created"*).

**Pickup/Return inspection dialog:** enter **Odometer**, **Fuel Level**, **Signature name**, **photos** (type URLs or **upload**), notes. On **return** also: damage description, **damage/cleaning/late/extra-km fees**. Click **Confirm Pickup/Return**.
- ✅ **End result:** *"Rental pickup confirmed"* / *"Rental return confirmed and settlement updated."*

### 5.7 Account
- Edit profile (name, email, phone +263, company, address) → **Save Profile**. View **Subscription** (with **Pay with ClicknPay** if due). **Sign Out**.

---

## 6. Driver Portal — `/fleet` (driver view)

A focused **Availability** screen.
1. Toggle **Show me in driver search**, **Looking for work**, **Available now**.
- ✅ **End result:** *"Availability updated"* — controls whether you appear in the driver marketplace.
2. **Subscription** panel: if your **Driver Annual** plan is unpaid, click **Pay Subscription** → ClicknPay.
- ✅ **End result:** you only appear in the marketplace once the annual subscription is paid (a banner reminds you).

---

## 7. Courier Desk — `/courier` (clerks/agents)

For depot/bus-station agents. **Tabs:** Shipments · (Admins also see) Depots. The list defaults to **"My day"** with a daily cash summary.

### 7.1 Create a courier shipment
1. Click **+ New Shipment**.
2. Enter **Route** (origin/destination depot or free-text names), **Sender** (name+phone), **Recipient** (name+phone).
3. Choose **Collect at depot** or **Deliver to address** (enter the delivery address for delivery).
4. Add **Items** (description, qty, kg) — a **live weight-based charge** is shown.
5. Tick **Payment collected at the counter**; optionally add bus operator/plate and an extra SMS contact.
6. Click **Create & Print Label**.
- ✅ **End result:** the shipment is created with a `CR-…` reference and a **QR label**; the sender/recipient are notified.

### 7.2 Print labels (one per item)
On the shipment's label card:
1. Set **Copies (one per item)** — defaults to the number of items.
2. **Print N label(s)** → browser print dialog (any OS/Wi-Fi/AirPrint/Mopria printer); or **Download ZPL** (.zpl file); or **Send to Zebra** (enter the printer IP for a networked Zebra).
- ✅ **End result:** large, bold labels print — stick one on every item.

### 7.3 Move a shipment through its stages
On the shipment detail (open from the list or **Scan** a label):
- **Mark Loaded on Bus** → **Mark In Transit** → **Scan Arrival**.
- If **collection**: **Record Collection** — capture the collector's **name + ID number (+ optional ID/face photo)** → ✅ marked *Collected/Delivered*.
- If **delivery**: on arrival it's **broadcast to transporters** for last-mile delivery (✅ status *Arranging delivery → Out for delivery → Delivered*).
- Each step notifies the sender (app/push) and recipient (SMS).

### 7.4 Depots (admins)
- **Depots** tab → list depots and **Add Depot** (name, code, city, address, phone).
- ✅ **End result:** depots become selectable in the create form.

---

## 8. Admin Console — `/admin`

**Sidebar:** Dashboard · Users · Verifications · Jobs · Payments · Rentals · Monetization · Insurance · Disputes · Reviews · SOS · Support · Settings. Badges flag pending verifications and unattended disputes.

### 8.1 Dashboard
- **Time-range selector** (Today/Week/Month/Year) updates the stats: Revenue, Bookings, Active Jobs, Current Users (with growth %), Disputes. Shows active jobs and recent audit activity. **Export Report** → CSV.

### 8.2 Users (and create Admin/Clerk)
- **Search** + **Type** + **Status** filters; paginated table.
- **Create a Clerk/Admin:** click **+ Add Admin/Clerk** → enter Full Name, Email, Mobile (+263), **Temporary Password**, **Platform Access** (Main Administrator / Administrator / **Clerk**), optional customer roles → **Create User**.
  - ✅ **End result:** *"Platform user created."* A **Clerk** can now log in and lands on the Courier Desk (`/courier`).
- **Eye icon** → user details + verification tools. **Edit icon** → change Primary Role (incl. Clerk), Platform Access, customer roles → **Save Role**. **Ban/Activate** toggles status. **Export** → CSV.

### 8.3 Verifications
- Same view filtered to non-shipper accounts needing review. Open a user → review documents, run **Authority Checks** (authority, method, result, reference, expiry, notes) → **Approve** or **Reject Verification**.
- ✅ **End result:** the account's verification status updates with an audit trail.

### 8.4 Jobs
- Filter by status/user. **Eye icon** → job details incl. the admin-only **earnings breakdown** (gross, transporter, insurance, PalmTrent) and live tracking.

### 8.5 Payments
- Stats + filters (status, method). **Eye** → details; **Receipt** → CSV; **Verify** (cash-agent) → confirm EcoCash receipt; **Run EcoCash Reconcile** → auto-checks pending agent payments; **Export** → CSV.

### 8.6 Rentals
- Filter by status. Per row: **Confirm Payment**, **Extend** (new end date + cost), **Cancel** (reason), **Mark Disputed** (reason), **Settle**.
- ✅ **End result:** the rental's lifecycle/settlement ledger is updated (cash rentals don't create an owner payout).

### 8.7 Monetization
- **Plan Builder** — create/edit subscription plans (code, name, audience, cycle, price, limits, features, flags) → **Save Plan**.
- **Commission Rule Builder** — platform/transporter/rental rates by target/audience/payment method/priority → **Save Commission Rule**.
- **Subscription Manager** — assign/edit a subscriber's plan, status, payment, seats, billing dates; **Mark Paid**.
- **Payouts** — **Manage** a payout (status, method, references, bank/phone) → **Save Payout**; Approve / Mark Paid.

### 8.8 Insurance
- **Add/Edit Provider** — provider details + commission, then add **Products** (code, name, coverage, premium %, limits, cargo types, exclusions) → **Save Provider**.

### 8.9 Disputes
- Stats + status filter; dispute cards show parties, type, amount, date.
- **View Details / Resolve** → enter resolution, pick outcome (favour complainant/respondent/partial), set refund → **Submit Resolution** (✅ *"Dispute … resolved."*). **Contact Parties** opens email.

### 8.10 Reviews
- Read-only list of all platform ratings (reviewer → reviewee, stars, comment, booking, date).

### 8.11 SOS / Emergency
- Stats + emergency table. Per request: **Acknowledge**, **Dispatch support**, **Resolve**; accept/reject roadside **quotes**. **Roadside Providers** table: **Approve / Reject** provider verification.

### 8.12 Support
- Filter tickets by status; open a ticket to **change status** and **reply**.
- ✅ **End result:** the ticket updates and the customer receives your response.

---

## 9. Public & Utility Pages

### 9.1 Public tracking — `/tracking/:trackingId`
- Anyone with the link sees the booking reference/status, pickup → delivery route, assigned transporter, and a chronological **tracking events** timeline. No login required.

### 9.2 Payment return — `/payment/return`
After ClicknPay you're returned here. It polls payment status (every 5s, up to ~3 min) and shows:
- **Confirmed** — *"Payment confirmed…"* → proceed (Go to Dashboard).
- **Failed / Cancelled** — return to your dashboard to retry.
- **Processing** — check again later from the dashboard.

### 9.3 API docs — `/api-docs`
- Reference for the corporate API (use your corporate API key from Settings as a Bearer token): profile, invoices, users, bookings endpoints.

### 9.4 Legal — `/terms`, `/privacy`
- Terms of Service and Privacy Policy.

---

## 10. Appendix: conventions

- **Phone format:** Zimbabwean **+263XXXXXXXXX** (the app auto-converts `07…`/`263…`).
- **Passwords:** minimum 8 characters; invited staff/drivers/team get a **temporary password** and must change it on first login.
- **Payments:** customer-facing payments go through **ClicknPay** (card, bank, EcoCash, OneMoney). After paying you return to `/payment/return`.
- **CSV exports** are available on most tables (bookings, payments, users, invoices, reports).
- **Live tracking** uses a websocket; when connected you'll see a "live" indicator and moving location/speed.
- **Who creates whom:** Admins create Admins & Clerks; Corporate admins create team members; Fleet owners create drivers & rental staff; the public self-registers as Shipper/Transporter/Trailer Owner/Rental Owner/Driver/Corporate.

---

## 11. Mobile App (iOS / Android)

The mobile app gives each role its own **bottom-tab navigator**. Sign-in, registration, password reset and the forced first-login password change work the same as on web (§1).

| Role | Bottom tabs |
|---|---|
| Shipper / Corporate | Home · Tracking · History · Profile |
| Transporter | Home · Jobs · SOS · Fleet · Drivers · Profile |
| Trailer / Rental owner | Home · Fleet · Market · Rentals · Staff · Drivers · Profile |
| Driver | Deliveries · Work · Progress · Alerts · Profile |
| Roadside responder | SOS · Alerts · Profile |
| Clerk / Agent | Desk · Arrivals · Scan · Profile |

The **Home** screen shows role-specific quick actions (e.g. Shipper: Book Transport, Track, My Bookings, Rent a Vehicle/Trailer, My Rentals, My Courier Shipments; Corporate adds Manage Team; Clerk: Courier Desk, Arrivals, Scan, New Shipment).

### 11.1 Shipper (mobile)
- **Book Transport** → enter cargo (type/weight/value, optional insurance) → pickup & delivery → date/time → review price → choose payment (Mobile Money / Card / Cash via Agent). ✅ Booking created and matching begins.
- **Mobile Money payment**: confirm phone → approve the prompt → the screen polls until confirmed. ✅ Booking paid.
- **Tracking tab**: live map, status timeline, ETA, driver contact.
- **History tab**: filter bookings; tap to track.
- **Rentals**: Rent a Vehicle/Trailer → request → My Rentals (pay, pickup/return). **My Courier Shipments**: track goods sent by bus.
- **Rating**: after delivery, rate stars + categories + "would use again". ✅ Rating recorded.

### 11.2 Transporter (mobile)
- **Jobs tab**: browse/filter available jobs → open a job → pick a vehicle → complete the pre-acceptance checklist → **Accept**. ✅ Job assigned.
- **Pickup checklist**: arrive → verify goods → photos (min 3) → shipper signature → Complete Pickup.
- **Delivery checklist**: arrive → verify recipient → offload/inspect → photos → (cash-on-delivery: mark cash collected) → recipient signature → Complete Delivery. ✅ Earnings scheduled (≈24h).
- **Fleet**: add vehicles + photos, add drivers, assign driver↔vehicle (or hire from the Driver Marketplace), assign a vehicle to a shipment.
- **Earnings**: set payout method (EcoCash/OneMoney/Bank) and request withdrawals.
- **Verification**: 5-step KYC (personal → ID → licence → selfie → submit).
- **SOS button**: pick emergency type → GPS sent → support alerted.

### 11.3 Driver (mobile)
- **Work/Availability**: complete profile, toggle search visibility / looking-for-work / available; pay the annual subscription to appear in the marketplace.
- **Deliveries**: start pickup trip → confirm pickup → start transit → arrived → confirm delivery; share live location; chat; SOS.

### 11.4 Trailer / Rental owner (mobile)
- **Fleet**: list/manage assets; register a trailer/asset (owner info → details & photos → rental terms → payment & insurance).
- **Market/Rentals**: browse & request; approve/reject incoming requests; create walk-in rentals.
- **Collection & return inspection**: odometer, fuel, photos, signature; on return add damage/cleaning/late/extra-km fees. ✅ Settlement updated.
- **Staff**: add rental staff with role (Manager / Agent / Viewer).
- **Trailer detail → Service Log**: add maintenance records (type, description, cost, odometer, performed by).

### 11.5 Roadside responder (mobile)
- Complete responder profile (services, vehicle, radius) and go online → receive SOS → submit quote → Accept → On Scene → Complete. ✅ Paid via the platform.

### 11.6 Clerk / Agent (mobile — Courier Desk)
- **Desk**: New Shipment (route, sender, recipient, items → weight-based price, payment at counter) → Create & Print Label.
- **Labels**: set copies (one per item) → Print / Download ZPL / Send to Zebra.
- **Stages**: Mark Loaded → In Transit → **Scan Arrival** → Record Collection (capture collector name + ID/face) **or** auto-broadcast for last-mile delivery.
- **Arrivals tab**: process inbound shipments. **My day**: today's shipments + cash collected/outstanding.

### 11.7 Shared (mobile)
- **Chat**: message the other party on a booking/rental in real time.
- **Notifications / Alerts**: list, filter unread, mark all read; tapping a push opens the relevant screen.
- **Profile**: edit name/email/phone (+263)/address; change password; logout.
- **Corporate Team**: invite members (name/email/phone + role); cycle roles or remove.
