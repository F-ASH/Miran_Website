# Miran (مِران) — Interactive Prototype

**Emotional Intelligence Practice and Feedback System for Job Interviews**
CPIS 498 Senior Project 1 · Group H · Faculty of Computing and Information Technology, King Abdulaziz University
Supervisor: Dr. Sahar Jambi · Team: Asma Alattas, Lama Alsulami, Fadia Ashmawi

A horizontal, clickable prototype of the Miran web platform. It runs entirely in the browser (HTML, CSS, JavaScript), with no server or build step, so it can be hosted on GitHub Pages.

## Try it

Open `index.html`, or the GitHub Pages link once it is published.

| Account | Email | Password |
|---|---|---|
| Candidate (5 past sessions) | sara@example.com | Miran2026 |
| Administrator | admin@miran.app | Admin2026 |

You can also create a new account. A new account goes through sign-up, then consent, then an empty dashboard.

## Page order (Chapter 4: Prototype Design)

Sign-up and sign-in come first, as the supervisor asked (#112):

1. `index.html`: sign in, with a forgot-password option and error messages
2. `signup.html`: sign up, with validation (valid and unused email, password of 8+ characters with a number)
3. `consent.html`: consent before any recording, the camera-measures choice, 30-day auto-delete, and field and role
4. `dashboard.html`: home dashboard with the suggested next session and its rule, skill levels on a 0–10 scale, streak, badges, and the progress-by-skill graph
5. `setup.html`: session setup. Choose a role or paste a job description, then a full or focus session. The focus skill can be **suggested or chosen manually**. Difficulty is basic or advanced.
6. `record.html`: camera, microphone and lighting check, then one question per screen. Each answer can be recorded, replayed and re-recorded.
7. `rate.html`: self-rating once at the end, per question and per criterion, 1–5, without replay
8. `report.html`: session report grouped by EI component. It shows each measure against its threshold, evidence with timestamps, the system result next to the self-rating for every question, a lesson link for each weakness, and the next step in the loop.
9. `lessons.html`: lesson library. Each lesson runs tips → 3-question quiz → status, and the quiz result is stored.
10. `reports.html`, `settings.html`: report history, plus privacy (camera measures, deleting recordings or the account)
11. `admin.html`: administrator view for the question bank, lessons and the measures/thresholds table

## Rules implemented (from the 11 Nov supervisor review)

- **#116 Score scale:** every EI component is scored 0–10. Levels: Lv1 0–4, Lv2 4–5.5, Lv3 5.5–7, Lv4 7–8.5, Lv5 8.5–10. The scale appears on the graph axis.
- **#117 Normal vs focus session:** a full session measures all five components. A focus session measures only its target component, so the graph has no point for the other components in that session.
- **#118 Focus skill:** suggested (lowest-scoring component) or chosen by the candidate.
- **#119 Self-rating:** given once at the end, per question and per criterion, without replay. It is stored and compared with the system result for each question.
- **#120 Thresholds:** pace 120–160 wpm · fillers under 3/min · long pauses (over 2 s) 0–2 per answer · eye contact 60%+ · smiling 15%+ · STAR 4 of 4 · relevance 4–5 · self-rating gap 1 or less.
- **#121 Low light:** when the average frame brightness is too low, eye contact and smiling show as "not measured" and do not count toward the level.
- **#122 Lessons:** tips → quiz → status (not started / open / passed). The quiz score is stored.
- **#113 Learning loop:** session → self-rating → report by component → lesson → suggested session. This loop is shown on the dashboard and the report.

## How the prototype works

- The camera and microphone are real (`getUserMedia`). Recordings are kept in the browser (IndexedDB) for replay, and report evidence opens the video at that moment.
- In Chrome and Edge, speech is transcribed live (Web Speech API). Pace, filler words and long pauses are then calculated from your real speech. In other browsers, or with **Use a sample answer**, a sample transcript is used instead.
- Content measures (relevance, EI shown, STAR) are simulated by simple rules. In the real system they come from the generative AI rubric (Table 1).
- Accounts, sessions and lesson progress are saved in `localStorage`. Passwords are stored as SHA-256 hashes. To start over, go to **Settings → Reset prototype data**.

## Publish on GitHub Pages

1. Create a new repository on GitHub, for example `miran-prototype`.
2. Click **Add file → Upload files**, select **all the files in this folder** (Cmd + A) and drop them in. There are no subfolders, so everything uploads in one go.
3. Go to **Settings → Pages → Build and deployment**. Set Source to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then click **Save**.
4. After a minute the site is live at `https://<your-username>.github.io/miran-prototype/`.

The camera only works over HTTPS (GitHub Pages) or `localhost`. If you open `index.html` straight from your computer, use **Continue without camera** or the sample answers.

## Structure

All files sit at the top level (no folders), so they can be uploaded through GitHub's website in one step.

```
Pages:   index.html  signup.html  consent.html  dashboard.html  setup.html
         record.html  rate.html  report.html  reports.html  lessons.html
         settings.html  admin.html
Style:   style.css                 brand palette taken from the Miran logo
Images:  miran-logo.png  miran-mark.png  favicon.png
Scripts: data.js                   EI components, 9 measures + thresholds, questions, lessons, badges
         app.js                    storage, auth, layout, analysis engine, suggestion and badge rules, chart
         auth.js dashboard.js setup.js record.js rate.js report.js lessons.js admin.js
```

Practice only. Miran never shares results with employers and makes no hiring decisions.
