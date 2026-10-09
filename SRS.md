# Software Requirements Specification

**Project Title:** Ticket Tap – Movie Ticket Booking Web Application
**Document Version:** 1.0
**Prepared by:** A. Hemesh / U24AI4012
**Guide:** Mr. Sugumar Govindhan
**Department / College:** B.Tech AI / Sri Lakshmi Narayana College of Engineering
**Academic Year:** 2026–27

## 1. Introduction

Ticket Tap is a web application where users browse movies, pick a show and seats, pay online (simulated) and get an e-ticket. This SRS follows the IEEE 830 format and states what the system must do.

**In scope:** registration and login, movie search, show and seat selection, booking with simulated payment, e-ticket, booking history and cancellation, and an admin panel.

**Out of scope:** real payment gateway, mobile apps, food ordering, and theatre-partner login.

**Key terms:** a Show is a movie screening at a set date, time and screen. A Seat Lock is a temporary hold on seats while the user pays.

## 2. Overall Description

| User | What they can do |
|---|---|
| Guest | Browse movies and shows; cannot book |
| Customer | Register, book and cancel tickets, view history |
| Admin | Manage movies, theatres, shows, coupons, users and bookings |

**Suggested technology:** HTML, CSS and JavaScript (React optional) for the front end; Node.js/Express, Spring Boot or Laravel for the back end; MySQL or PostgreSQL for the database; runs in any modern browser.

**Constraints and assumptions:**
- Payment is simulated, and no real card or bank data is stored.
- A seat must never be booked twice for the same show.
- Passwords are stored hashed.
- The admin enters or loads sample movie, theatre and show data.

## 3. Functional Requirements

Priority: **H** = must have, **M** = should have.

**Accounts**
- **FR-1 (H)** Register with name, email, mobile and password, with input validation and unique email.
- **FR-2 (H)** Log in and out; restrict booking pages to customers and admin pages to admins.
- **FR-3 (M)** Reset a forgotten password by email link or OTP.

**Movies**
- **FR-4 (H)** Show Now Showing and Upcoming movies with poster, language, genre and rating.
- **FR-5 (H)** Search by title and filter by language, genre and date.
- **FR-6 (H)** Movie details page with synopsis, cast, duration, certificate, trailer link and shows.

**Shows and seats**
- **FR-7 (H)** For a movie and date, list theatres and show timings.
- **FR-8 (H)** Show a seat layout with available, selected and booked seats in different colours; allow up to 6 seats per booking.
- **FR-9 (H)** Lock selected seats for 5 minutes during payment and release them automatically if payment is not completed.
- **FR-10 (H)** Prevent two users from booking the same seat, even if they choose it at the same time.
- **FR-11 (M)** Support seat categories (Regular, Premium) with different prices.

**Booking and payment**
- **FR-12 (H)** Show a booking summary with movie, theatre, show time, seats, taxes and total.
- **FR-13 (M)** Apply a coupon code for a discount.
- **FR-14 (H)** Provide a simulated payment page (Card, UPI, Net Banking) that can return success or failure.
- **FR-15 (H)** On success, confirm the booking and mark seats booked; on failure or timeout, release the seats and allow retry.

**Ticket**
- **FR-16 (H)** Generate an e-ticket with booking ID, movie, theatre, screen, time, seats, amount and QR code.
- **FR-17 (M)** Allow PDF download of the ticket and send a confirmation email.

**My bookings**
- **FR-18 (H)** Show upcoming and past bookings with status (Confirmed, Cancelled).
- **FR-19 (H)** Allow cancellation up to 2 hours before the show; free the seats and show a simulated refund status.

**Admin**
- **FR-20 (H)** Add, edit and delete movies, theatres, screens and shows.
- **FR-21 (H)** View all bookings and users.
- **FR-22 (M)** Manage coupons and view a dashboard with total bookings, revenue and popular movies.

## 4. Non-Functional Requirements

- **Performance:** pages load within 3 seconds; supports at least 100 users at once.
- **Security:** hashed passwords, input validation against SQL injection and XSS, role-based access, session expiry.
- **Reliability:** bookings use database transactions so a booking is saved completely or not at all.
- **Usability:** a new user can book a ticket in about 5 steps (movie, show, seats, pay, ticket); layout works on desktop and mobile.
- **Maintainability:** modular, commented code in a Git repository.

## 5. External Interfaces

- **User interface:** responsive pages; seat map coloured green (available), grey (booked) and blue (selected).
- **Software:** database, a QR code library, a PDF library, and an optional email service.
- **Communication:** the front end talks to the back end through REST APIs using JSON over HTTP/HTTPS.

## 6. Data Requirements

Main tables: **User**, **Movie**, **Theatre**, **Screen**, **Seat**, **Show**, **ShowSeat** (status: available, locked or booked), **Booking**, **BookingSeat**, **Payment** and **Coupon**.

A theatre has many screens, a screen has many seats and hosts many shows, and a movie has many shows. A user makes many bookings, and each booking covers one show, many seats and one payment.

## 7. Use Case, Testing and Future Scope

**Book tickets** (actor: customer, who must be logged in):
1. Choose a movie, date, theatre and show time.
2. Select seats on the layout; the system locks them.
3. Review the summary, apply a coupon if any, and pay.
4. The system confirms the booking and shows the e-ticket.

If a seat is already taken or payment fails, the seats are released and the user can choose again or retry.

**Sample test cases**

| Scenario | Expected result |
|---|---|
| Register with an existing email | Error shown, no new account |
| Log in with a wrong password | Login rejected |
| Two users pick the same seat together | Only one gets it |
| Payment succeeds | Booking confirmed, e-ticket shown |
| Payment not done in 5 minutes | Seats released |
| Cancel less than 2 hours before show | Cancellation refused |
| Customer opens an admin page | Access denied |

**Acceptance criteria:** all must-have requirements work, no double booking occurs in tests, and the full flow works on desktop and mobile with sample data loaded.

**Future scope:** real payment gateway, mobile app, food pre-booking, recommendations and theatre-partner login.
