# REST & WebSocket API Documentation

Real-Time Collaborative Code & Whiteboard Editor backend API specification.

---

## Base URLs
- **HTTP REST API:** `http://localhost:5000/api`
- **WebSocket Engine:** `ws://localhost:5000` (Socket.IO v4)

---

## 1. Authentication Endpoints

### `POST /api/auth/register`
Creates a new user account and seeds starter code and whiteboard documents.
- **Request Body:**
  ```json
  {
    "name": "Alex Rivera",
    "email": "alex@simplera.com",
    "password": "password123"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "message": "User registered successfully.",
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": {
      "id": "uuid",
      "email": "alex@simplera.com",
      "name": "Alex Rivera",
      "color": "#6366f1"
    }
  }
  ```

### `POST /api/auth/login`
Authenticates existing user with bcrypt password verification.
- **Request Body:**
  ```json
  {
    "email": "alex@simplera.com",
    "password": "password123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "message": "Login successful.",
    "token": "eyJhbGciOiJIUzI1Ni...",
    "user": { ... }
  }
  ```

### `GET /api/auth/me`
Retrieves current authenticated profile.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):** `{ "user": { ... } }`

### `PUT /api/auth/profile`
Updates display name, avatar URL, or collaborative cursor color.
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
  ```json
  {
    "name": "Alex Rivera (Lead)",
    "avatar": "https://...",
    "color": "#10b981"
  }
  ```

### `POST /api/auth/forgot-password`
Initiates password reset flow and dispatches email via Nodemailer.
- **Request Body:** `{ "email": "alex@simplera.com" }`

### `POST /api/auth/reset-password`
Resets password using cryptographic reset token.
- **Request Body:**
  ```json
  {
    "token": "crypto-token",
    "newPassword": "newPassword123"
  }
  ```

---

## 2. Document Management Endpoints

### `GET /api/documents`
Lists documents owned by user and documents shared with user.
- **Headers:** `Authorization: Bearer <token>`
- **Response (200 OK):**
  ```json
  {
    "owned": [...],
    "shared": [...]
  }
  ```

### `POST /api/documents`
Creates a new code editor or whiteboard document.
- **Request Body:**
  ```json
  {
    "title": "Interactive Code Playground",
    "type": "code",
    "language": "javascript"
  }
  ```

### `GET /api/documents/:id`
Retrieves document metadata, content, user's role (`owner`, `editor`, or `viewer`), and collaborators.
- **Headers:** `Authorization: Bearer <token>`

### `PUT /api/documents/:id`
Updates document title or language. *(Requires `owner` or `editor` role; blocked for `viewer` with 403 Forbidden).*

### `DELETE /api/documents/:id`
Permanently deletes document, versions, and collaborators. *(Requires `owner` role).*

### `POST /api/documents/:id/duplicate`
Clones document into a new copy owned by the current user.

### `POST /api/documents/:id/share`
Shares document with a collaborator by email with specified role (`editor` or `viewer`). Sends invitation email.

### `PUT /api/documents/:id/collaborators/:userId`
Changes collaborator role (`editor` ↔ `viewer`). *(Owner only).*

### `DELETE /api/documents/:id/collaborators/:userId`
Removes collaborator access. *(Owner only).*

---

## 3. Version History Endpoints

### `GET /api/documents/:id/versions`
Fetches chronological timeline of all auto and manual snapshot versions.

### `POST /api/documents/:id/versions`
Creates a manual snapshot milestone with custom description.

### `POST /api/documents/:id/versions/:versionId/restore`
Safely restores document to selected version. Creates a new version reflecting restored state without destroying historical versions.

### `PUT /api/documents/:id/access`
Updates document general access permission level (Owner only).
- **Request Body:**
  ```json
  { "accessLevel": "link_edit" }
  ```
  *(Options: `link_edit` | `link_view` | `restricted`)*
- **Response (200 OK):** `{ "message": "Access level updated successfully." }`

---

## 4. Code Execution Sandbox Endpoints

### `POST /api/execute`
Executes submitted code string in the sandbox runner and returns stdout, stderr, and execution duration.
- **Request Body:**
  ```json
  {
    "language": "cpp",
    "code": "#include <iostream>\nusing namespace std;\nint main() { cout << 10 * 4; return 0; }"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "output": "40",
    "error": null,
    "duration": 4
  }
  ```

---

## 5. WebSocket Real-Time Events (`Socket.IO`)

### Client-to-Server Events
| Event Name | Payload | Description |
|---|---|---|
| `doc:join` | `{ docId }` | Joins document room, initializes presence |
| `doc:leave` | `{}` | Leaves document room, triggers disconnect cleanup |
| `cursor:move` | `{ cursor: { x, y } \| { line, ch } }` | Broadcasts live cursor position |
| `code:change` | `{ content, language }` | Emits code edits (server blocks viewers) |
| `whiteboard:change` | `{ elements, action }` | Emits vector whiteboard edits |
| `chat:send` | `{ content }` | Sends document chat message |
| `doc:restored` | `{ versionNumber, content, language }` | Broadcasts restore event to room |

### Server-to-Client Broadcast Events
| Event Name | Payload | Description |
|---|---|---|
| `presence:update` | `ActiveUser[]` | Real-time list of online room users |
| `cursor:update` | `{ socketId, name, color, cursor }` | Live cursor marker updates |
| `cursor:remove` | `{ socketId }` | Removes disconnected user's cursor |
| `code:update` | `{ content, language, updatedBy }` | Synchronizes code updates |
| `whiteboard:update` | `{ elements, action, updatedBy }` | Synchronizes vector canvas updates |
| `chat:message` | `ChatMessage` | Live incoming chat message |
| `chat:history` | `ChatMessage[]` | Recent chat message history on join |
| `doc:reloaded` | `{ versionNumber, content, language }` | Forces clients to reload restored version |
| `notification:toast` | `{ type, message, user }` | In-app alerts when users join/leave/restore |
| `error:forbidden` | `{ message }` | Sent when viewer attempts unauthorized update |
