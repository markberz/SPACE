# Schedule Website & Mobile — Modern Design (HTML/CSS/JS)

A beautiful static scheduler web app with modern design, dark mode, and automated email reminders.

## Features

- 📅 **Monthly calendar** — Interactive calendar view with hover effects
- ✨ **Modern design** — Gradient backgrounds, smooth transitions, all elements styled
- 🌙 **Dark mode** — Toggle between light and dark themes with persistence
- 🔔 **Schedule notifications** — Pop-up at exact schedule time (Confirm/Cancel)
- 📧 **5-minute auto email** — Automatic email sent 5 minutes before event (if email provided)
- 📱 **Mobile responsive** — Works on desktop and mobile devices
- 💾 **Local storage** — Schedules saved in browser, no server needed
- 📋 **History tracking** — View confirmed and cancelled schedules

## Files

- `schedule_index.html` — Main HTML structure
- `schedule_styles.css` — Modern styles with dark mode support
- `schedule_app.js` — Calendar logic, reminders, notifications, history

## How to Run

Open `schedule_index.html` in your browser or serve locally:

```bash
python -m http.server 8000
# then open http://localhost:8000/schedule_index.html
```

## How It Works

1. **Add Schedule** — Fill in title, date, time, and optional email
2. **5-minute auto email** — If email provided, automatic email sent 5 minutes before
3. **At schedule time** — Notification modal pops up with Confirm/Cancel
4. **Confirm/Cancel** — Confirmed goes to Recent history, cancelled goes to Cancelled
5. **View History** — Switch between Recent and Cancelled tabs

## Email Reminders (5 minutes before)

Automatic email reminders work when:
- User provides an email address when creating the schedule
- The browser/page is open at reminder time
- Sends email 5 minutes before the scheduled time

### Optional: EmailJS for Guaranteed Sending

To get reliable email delivery without server:

1. Sign up at https://www.emailjs.com
2. Uncomment the EmailJS script in `schedule_index.html`:
```html
<script src="https://cdn.jsdelivr.net/npm/emailjs-com@2/dist/email.min.js"></script>
<script>
  emailjs.init('YOUR_EMAILJS_USER_ID');
  window.EMAILJS_CONFIG = {
    userId: 'YOUR_EMAILJS_USER_ID',
    serviceId: 'your_service_id',
    templateId: 'your_template_id'
  };
</script>
```
3. App will send via EmailJS, fallback to `mailto:` if it fails

## Modern Design

- **Light mode**: Clean white panels with purple gradients
- **Dark mode**: Dark backgrounds with softer accents
- **Animations**: Smooth hover effects, pop-in modals
- **Responsive**: Mobile-first layout that adapts to all screen sizes
- **All elements styled**: Calendar, buttons, inputs, modals, cards

## Toggle Dark Mode

Click the 🌙/☀️ button in the top-right corner. Your preference is saved.
