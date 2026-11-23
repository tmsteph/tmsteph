# tmsteph

Canonical source for **tmsteph.com** and my GitHub profile.

The website is intentionally boring to operate: plain HTML + CSS, no framework, no build step, and no generated dependency tree. Push `main`; Vercel serves the static files.

## What belongs here

- The tmsteph.com homepage
- Small supporting assets used directly by the homepage
- A few durable personal pages that are part of the public site
- My public open-source contribution notes

## What does not belong here

Experimental apps, one-off prototypes, private utilities, and unrelated tools should live in their own repositories. The former catch-all site remains available as a lab/archive at:

https://tmsteph-redesign-2025.vercel.app

## Links

- https://tmsteph.com
- https://3dvr.tech
- https://github.com/tmsteph

## Open Source Contributions

- **Debian / PulseAudio packaging** — Tested and reported a JACK2 Build-Depends fix for Debian bug #1143540. Verified a full Debian binary package build against JACK 1.9.22, including `pulseaudio-module-jack`. Working toward becoming a regular contributor / co-maintainer for the Debian PulseAudio package.
- PulseAudio Debian packaging: https://salsa.debian.org/pulseaudio-team/pulseaudio

## AV booking

The public portfolio lives at `/av/`. Its **Request a hold** button opens an email
draft and does not place a hold or book a gig. The portfolio's **See available
dates** link opens `/av/availability/`, which lists upcoming offered days and
opens a Pacific-time calendar to the earliest offered month. The date page
asks search engines not to index it, but is public and not access-controlled.
Unmarked days do not indicate availability or commitments.

Only add dates Thomas explicitly approves for sharing. His standing rule
(2026-11-23): any day with no personal or professional appointment is
available, and the list should reach a month or more out. The same day he
approved listing his Encore show days as booked with role and venue
(Manchester Grand Hyatt) in `bookedDays` in `av/availability/calendar.js`.
Available dates are tappable and draft a hold email for that day. Still never
commit a calendar feed, personal events, or reasons dates are blocked, and
keep the private conflict checks (the days held back for personal
appointments) out of the repo. Remove expired entries from both lists. Keep
private conflict checks and opportunity tracking in the existing
[Portal AV booking work](https://github.com/tmsteph/3dvr-portal/issues/2867).
