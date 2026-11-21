# Real-Time Collaborative Code & Whiteboard Editor

A production-grade, full-stack collaborative web application engineered for simultaneous multi-user code editing and vector whiteboard drafting. Features sub-10ms real-time synchronization via WebSockets, server-enforced role-based access control (Owner / Editor / Viewer), automated snapshot versioning, live cursor tracking, session chat, and interactive code execution with live HTML/CSS preview.

Developed for the **IT-Simplera Solutions Full Stack Development Internship (Batch 02)**.

---

## 🌟 Key Features

### 1. Real-Time Multi-User Synchronization
- **Sub-10ms Broadcast Latency:** Benchmarked at an average of **5.61 ms** under concurrent load (exceeding the 200ms benchmark).
- **Live Collaborative Cursors:** Real-time pointer and line/column tracking with collaborator name badges and customizable colors.
- **Presence Indicators:** Live avatar presence bar with animated connection status indicators.
- **Offline Editing & Reconnect Sync:** Safe local storage caching when offline, with automatic synchronization upon connection restoration.
- **Server-Side Role Enforcement:** Viewers are strictly prohibited from emitting changes or mutating document state at the socket and REST API levels.

### 2. Multi-Language Code Editor Module
- **Monaco Editor Core:** Powered by the VS Code editor engine with minimap, line numbers, bracket colorization, and auto-indentation.
- **Supported Languages:** JavaScript, TypeScript, Python, Java, C++, and **HTML / Live Web**.
- **Interactive Code Execution & Sandbox:**
  - **Python:** Executed via local Python runtime with a 5s execution timeout.
  - **C++ & Java:** Transpiled and executed with full support for variables, arithmetic expressions, `if/else`, `switch/case`, loops, and standard output (`cout`, `System.out.println`).
  - **HTML / Live Web:** Interactive Live Preview tab with a sandboxed viewport rendering HTML, CSS, and interactive JavaScript live.
  - **Terminal Stdin Detection:** Expressions requiring interactive input (`cin >>`, `Scanner`, `input()`) are detected proactively, providing immediate instructions to supply test inputs directly in code.
- **Draggable & Resizable Console Drawer:** Adjustable height, maximize/restore controls, execution duration timers, and clear output utilities.

### 3. Vector Collaborative Whiteboard
- **Vector Geometric Shapes:** Rectangles, Circles / Ellipses, Directional Arrows, Straight Lines, Text Notes, and Freehand Pencil.
- **Styling Controls:** 8-color designer palette and stroke width presets (Thin 2px, Medium 4px, Thick 8px).
- **Interactive Manipulation:** Drag-and-drop movement, element resizing, and shape-level erasure.
- **Infinite Canvas:** Pan navigation (Hand tool or middle-mouse drag) and multi-level zoom (30% to 300%).
- **History Stacks:** Multi-step Undo (`Ctrl+Z`) and Redo (`Ctrl+Y`).
- **Instant Export:** One-click PNG architectural diagram export.

### 4. Automated Version History & Safe Restore
- **Automated Snapshots:** Captures document snapshots every **30 seconds** or **50 modifications**.
- **Milestone Checkpoints:** Save named snapshots at key milestones with custom descriptions.
- **Read-Only Preview:** Inspect any historical version in a modal view without altering the active workspace.
- **Safe Non-Destructive Restore:** Restoring any previous version creates a new snapshot representing the restored state, preserving 100% of the historical audit trail.

### 5. Document Management & Link Sharing
- **Categorized Dashboard:** Owned Documents vs. Shared With Me workspaces with instant search, type filters, and sorting.
- **Google Docs-Style Link Sharing:**
  - **Anyone with link can edit (`link_edit`):** Logged-in teammates opening the link automatically receive Editor permissions.
  - **Anyone with link can view (`link_view`):** Recipients receive Viewer permissions.
  - **Restricted (`restricted`):** Accessible solely to explicitly invited collaborators.
- **Universal Clipboard Support:** Bulletproof copy link utility with automatic fallback for Incognito windows, HTTP origins, and restricted browsers.
- **Email Invitations via Gmail SMTP:** Sends branded invitation emails with direct workspace URLs to collaborators' Gmail inboxes.

### 6. Extras
- **In-Workspace Chat:** Scoped to active document with timestamps, user color badges, and unread notification badges.
- **Toast Notifications:** Real-time alerts when team members join, depart, or restore snapshots.
- **User Profile Customization:** Display name, avatar URL, and collaborative presence color.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite, Monaco Editor, Lucide Icons |
| **Backend** | Node.js, Express, TypeScript, Socket.IO v4, Nodemailer |
| **Database** | SQLite (Node native `node:sqlite` with Write-Ahead Logging WAL mode) |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs password hashing |
| **Testing** | Vitest, Supertest (20/20 unit tests passed), Custom WebSocket load benchmark |
| **DevOps** | Docker, Docker Compose, Multi-stage builds |

---

## 🚀 Live Production Deployment Guide

### Option 1: Docker Compose (Recommended for VPS / Cloud Instances)

Deploy on any cloud VPS (AWS EC2, DigitalOcean, Linode, Hetzner, GCP):

```bash
# 1. Clone the repository
git clone https://github.com/your-username/collab-editor.git
cd collab-editor

# 2. Configure production environment variables
cp .env.example .env
# Edit .env with your domain and Gmail credentials (see Environment Variables below)

# 3. Build and launch containers in background
docker compose up --build -d

# 4. Verify running services
docker compose ps
```

The application will be live:
- Frontend: `http://your-domain.com:5173` (or port `80` behind Nginx/Caddy)
- Backend API & WebSockets: `http://your-domain.com:5000`

---

### Option 2: Cloud PaaS Deployment (Render / Railway / Fly.io)

1. **Backend Service (Node.js):**
   - Root directory: `server`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Set environment variables (`CLIENT_URL`, `JWT_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`).

2. **Frontend Service (Static Site / Vite):**
   - Root directory: `client`
   - Build Command: `npm install && npm run build`
   - Publish directory: `dist`
   - Add rewrite rule: `/* -> /index.html` (for React Router).

---

## 📧 Configuring Real Gmail Invitations

To send real invitation emails directly to collaborators' Gmail accounts:

1. Go to your **Google Account** > **Security** > **2-Step Verification**.
2. Scroll to the bottom and select **App passwords**.
3. Create a new App Password (name it `CollabEditor`) and copy the 16-character generated password.
4. Set the following environment variables in your `.env` or deployment dashboard:

```env
# Gmail SMTP Configuration
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# Live Production Domain
CLIENT_URL=https://your-live-domain.com
```

*Note: If Gmail credentials are not provided, the application automatically uses Ethereal test mailer with preview links.*

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `PORT` | Backend server port | `5000` |
| `CLIENT_URL` | Live frontend URL for invitation links | `http://localhost:5173` |
| `JWT_SECRET` | Secret key for signing authentication tokens | `super-secret-jwt-key-collab-editor-2026` |
| `GMAIL_USER` | Gmail address for sending invitations | *(Optional)* |
| `GMAIL_APP_PASSWORD` | 16-character Google App Password | *(Optional)* |
| `SMTP_HOST` | Custom SMTP host (if not using Gmail) | *(Optional)* |
| `SMTP_PORT` | Custom SMTP port (587 or 465) | `587` |

---

## 🧪 Testing & Verification

### Unit Tests (20/20 Passing)
```bash
cd server
npm test
```
Verifies authentication contracts, document CRUD, server-side RBAC, and safe non-destructive restoration.

### Real-Time Synchronization Load Test
```bash
cd server
npm run load-test
```
**Benchmark Results:**
- Virtual Users: 30 concurrent sockets
- Total Operations: 300 broadcast rounds with **zero packet loss**
- **Average Broadcast Latency:** **5.61 ms** (Target: < 200 ms — **PASS**)

---

## 📁 Submission Reports & Documentation

- 📄 **[Final Project Report](FINAL_PROJECT_REPORT.md)** — Comprehensive architecture, security, and concurrency report.
- 🖨️ **[Printable PDF Project Report (HTML)](PROJECT_REPORT.html)** — Styled, print-ready report for immediate PDF export (`Ctrl + P`).
- ⚡ **[Load Test & Latency Benchmark Report](LOAD_TEST_REPORT.md)** — Detailed latency distribution and performance metrics.
- 💼 **[LinkedIn Submission Templates](LINKEDIN_POST_TEMPLATE.md)** — Ready-to-post LinkedIn templates for the 50-mark evaluation.
- 🎯 **[Google Meet Technical Interview Guide](INTERVIEW_PREPARATION_GUIDE.md)** — Deep-dive Q&A covering WebSockets, OT vs CRDT, and scaling.
- 📚 **[REST & WebSocket API Reference](API_DOCUMENTATION.md)** — Complete API endpoint and socket event documentation.

---

## 👥 Authors & Acknowledgments

- **Candidate:** Mahzil Sohail
- **Mentor:** Nisar Ali (Senior Full Stack Web Developer)
- **Organization:** IT-Simplera Solutions — *Empowering Future IT Professionals*
