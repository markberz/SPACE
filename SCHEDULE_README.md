# Schedule Website & Mobile (HTML/CSS/JS)

This is a simple static scheduler web app prototype. It includes:

- Monthly calendar view (click a date to prefill the add form)
- Add schedule with title, date, time, optional email
- Stores schedules in `localStorage`
- Quick actions: `mailto:` links for Email (platform dependent)
- Guided AI chat modal that asks users questions and creates a schedule

Files

- `schedule_index.html` — main page
- `schedule_styles.css` — styles
- `schedule_app.js` — client-side logic

How to run

Open `schedule_index.html` in a browser or serve the folder via a local static server:
```bash
python -m http.server 8000
# then open http://localhost:8000/schedule_index.html
```

Email integration

- The demo uses `mailto:` links which rely on client platform handlers and do not send messages themselves.
- For real automated emails you need a server or a client-side service (e.g., EmailJS, SendGrid). Secure API keys must be stored server-side.

Reminder emails (5 minutes before)

- The app now schedules a reminder 5 minutes before each event time while the page is open. When the reminder triggers the app will:
	- Attempt to send via EmailJS if you include the EmailJS SDK and set `window.EMAILJS_CONFIG` (see below).
	- Otherwise open the user's mail client with a `mailto:` link and show a desktop toast/notification.

Note: Browser timers and notifications require the page to be open (or the browser running). For reliable server-side reminders use a backend (serverless cron or scheduled worker) with SendGrid or similar.

EmailJS client setup (optional)

1. Sign up at https://www.emailjs.com and create a service + email template.
2. Include the EmailJS SDK in `schedule_index.html` (below `schedule_app.js`):

```html
<script src="https://cdn.jsdelivr.net/npm/emailjs-com@2/dist/email.min.js"></script>
<script>emailjs.init('YOUR_EMAILJS_USER_ID');</script>
```

3. In the browser console (or your own script before `schedule_app.js` runs) set the config:

```js
window.EMAILJS_CONFIG = {
	userId: 'YOUR_EMAILJS_USER_ID',
	serviceId: 'your_service_id',
	templateId: 'your_template_id',
	templateParams: {} // optional defaults
};
```

4. The app will call `emailjs.send(serviceId, templateId, templateParams, userId)` to send reminder emails.

Security note

- EmailJS allows client-side sending but exposes functionality to the browser; for high-volume or sensitive use prefer sending reminders from a secure server.
Next steps I can implement for you

- Integrate `EmailJS` for direct client-side email sending (no server needed)
- Add a small serverless function (Azure/AWS/Netlify) to send emails using SendGrid or similar
- Replace the simple guided chat with a hosted AI (OpenAI/GPT) — requires API key and server-proxy for security
