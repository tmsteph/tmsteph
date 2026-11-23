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

Only add date windows Thomas explicitly approves for sharing. Never commit a
calendar feed, raw availability, employer or personal events, or reasons dates
are blocked. Add approved full-day entries only to `offeredDays` in
`av/availability/calendar.js`, remove expired entries, and never
treat a missing calendar event as permission to offer a date. Keep private
conflict checks and opportunity tracking in the existing
[Portal AV booking work](https://github.com/tmsteph/3dvr-portal/issues/2867).
