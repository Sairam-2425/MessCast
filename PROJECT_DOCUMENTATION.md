# MessCast — Complete Project Documentation

**Document Type:** Executive Report / Technical Documentation / Feature Inventory / API Documentation / Database Documentation / Deployment Guide / Future Roadmap
**Prepared from:** File-by-file analysis of the entire repository at `f:\Messanger`
**Audience:** Executives, new developers, maintainers, and operators

---

## 1. Executive Summary

MessCast is a production-grade, full-stack real-time messaging platform consisting of three deployable applications sharing one MongoDB database and one REST/Socket.IO backend:

| Application | Stack | Location | Deployment |
|---|---|---|---|
| **Backend API & Realtime Server** | Node.js, Express 4, Socket.IO 4, Mongoose 7 | `backend/` | Render.com (`messcast-backend`, Singapore, Free plan) |
| **Mobile App** | Expo SDK 54, React Native 0.81, Expo Router 6, TypeScript | `mobile/` | Android APK/AAB via EAS Build (`com.messcast.app`) |
| **Admin Web Panel** | React 18, Vite 5, MUI 5, TypeScript | `admin/` | Static build (`dist/`), deployable to Render/static hosting |

The system supports email and phone (OTP/Firebase) authentication, one-to-one and group chats, text/file/image/voice messages, replies, forwarding, reactions, edits, deletions, message pinning, read/delivery receipts, typing indicators, online presence, push notifications, and a full administrative back office (user management, conversation moderation, file/storage monitoring, dashboards, and global settings).

File storage has been fully migrated to **Cloudinary** (commit `eec27cd`), replacing the original ephemeral local-disk storage that did not survive Render redeploys. Authentication supports three parallel paths: email/password, phone+OTP via 2Factor.in, and Firebase phone authentication — selectable via the `OTP_PROVIDER` environment variable.

The codebase is mature and actively maintained — recent commits show ongoing production hardening: Cloudinary migration, EAS Android build preparation, keyboard/UX fixes, voice-message playback fixes, and (most recently) a complete rebuild of the document viewer to open files in their native apps via Android `ACTION_VIEW` intents.

---

## 2. Project Overview

**Name:** MessCast
**Purpose:** A WhatsApp-style real-time chat application with an integrated administrative control panel.
**Core value proposition:** Secure, real-time messaging with rich media support (images, documents, voice notes), group management, and centralized moderation/analytics for administrators.

**Primary user roles:**
- **User** (`role: 'user'`) — registers, chats one-to-one or in groups, manages own profile.
- **Admin** (`role: 'admin'`) — everything a user can do, plus access to a dashboard, user/conversation/file moderation tools, broadcast messaging, and global app settings (both via the mobile `(admin)` tab group and the standalone admin web panel).

**Repository root contents:**
```
f:\Messanger
├── admin/            React + Vite + MUI admin web panel
├── backend/          Express + MongoDB + Socket.IO API server
├── mobile/           Expo / React Native mobile app
├── docker-compose.yml  Local dev orchestration (backend + MongoDB)
├── render.yaml       Render.com deployment manifest (backend service)
├── package.json      Root-level placeholder (only declares a TypeScript devDependency)
└── ui-ux-pro-max-skill/  Design/skill assets (non-runtime)
```

---

## 3. System Architecture

```
                                   ┌────────────────────────────┐
                                   │        Cloudinary          │
                                   │  (avatars, files, images,  │
                                   │   audio, documents – CDN)  │
                                   └─────────────▲──────────────┘
                                                 │ HTTPS upload/URLs
                                                 │
 ┌───────────────┐   REST (Axios, JWT)   ┌───────┴────────────┐    REST (Axios, JWT)   ┌──────────────────┐
 │  Mobile App    │◄─────────────────────►│                    │◄───────────────────────►│  Admin Web Panel  │
 │ (Expo Router,  │                       │   Express Backend  │                         │ (React + Vite +   │
 │  React Native) │   Socket.IO (WS,     │   (Node.js, REST   │                         │  MUI, port 3000)  │
 │                │   JWT in handshake)   │   + Socket.IO)     │                         │                  │
 └───────┬────────┘◄─────────────────────►│                    │                         └──────────────────┘
         │                                 │  • Helmet/CORS     │
         │ Push (Expo/FCM)                 │  • Mongoose ODM    │           ┌──────────────┐
         │                                 │  • Multer uploads  │──────────►│   MongoDB     │
         ▼                                 │  • Cloudinary SDK  │  Mongoose │ (Mongo 6,     │
 ┌────────────────┐                        │  • JWT auth        │◄──────────│  Atlas/local) │
 │ Push Provider   │                        │  • SMTP (Nodemailer)│          └──────────────┘
 │ (Expo/Firebase  │                        │  • 2Factor.in SMS  │
 │  Cloud Msg.)    │                        │  • Firebase Admin  │
 └────────────────┘                        │  • Twilio (legacy) │
                                            └────────────────────┘
                                            Render.com (Singapore, free plan)
                                            Health check: GET /health
```

**Communication patterns:**
1. **REST (HTTPS + JWT Bearer token)** — all CRUD operations: auth, users, conversations, messages, admin operations. Both the mobile app and admin panel use Axios instances with request interceptors that auto-attach `Authorization: Bearer <token>`.
2. **Socket.IO (WebSocket, JWT in handshake `auth.token`)** — real-time events: new messages, edits, deletions, reactions, read/delivery receipts, typing indicators, online presence, group membership changes, forced logout (ban).
3. **Cloudinary (HTTPS)** — all binary content (avatars, group avatars, chat images, documents, voice notes) is uploaded directly from the backend (via Multer memory storage → Cloudinary SDK) and served as permanent CDN URLs stored in MongoDB.
4. **Push notifications** — Expo push tokens / FCM tokens stored on the User document (`pushToken`), used by the backend (`axios` to Expo's push API) when new messages arrive while the recipient is not actively connected.

---

## 4. Technology Stack

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Backend runtime | Node.js + Express | Express ^4.18.2 | REST API |
| Realtime | Socket.IO | ^4.7.2 | WebSocket transport |
| Database | MongoDB + Mongoose | Mongoose ^7.5.0 | Atlas (prod) / Docker `mongo:6` (dev) |
| Auth | JSON Web Tokens, bcryptjs | jsonwebtoken ^9.0.0, bcryptjs ^2.4.3 | 30-day tokens, bcrypt hashing |
| File storage | Cloudinary SDK | ^2.10.0 | CDN-backed persistent storage |
| Phone OTP | 2Factor.in (axios), Firebase Admin SDK | firebase-admin ^13.10.0 | Selectable via `OTP_PROVIDER` |
| Email | Nodemailer (SMTP) | ^8.0.7 | Password-reset emails |
| Legacy SMS | Twilio | ^6.0.2 | Welcome SMS only |
| Security middleware | Helmet, CORS, compression, morgan | — | HTTP hardening, logging |
| Mobile framework | Expo SDK | ~54.0.35 | Managed workflow |
| Mobile runtime | React Native / React | 0.81.5 / 19.1.0 | New Architecture enabled |
| Mobile routing | Expo Router | ~6.0.24 | File-based routing, typed routes |
| Mobile state | Zustand | ^4.4.7 | Lightweight global stores |
| Mobile animation | react-native-reanimated | ~4.1.1 | Gesture-driven UI (swipe-to-reply, etc.) |
| Mobile media | expo-av, expo-image-picker, expo-document-picker, expo-file-system, expo-sharing, expo-intent-launcher | — | Voice notes, images, document viewer |
| Admin framework | React + Vite | React 18.2 / Vite ^5.0.0 | SPA |
| Admin UI kit | MUI (Material UI) + MUI X DataGrid | ^5.15.0 / ^6.18.0 | Tables, dashboard, theme |
| Admin charts | Recharts | ^2.10.0 | Line/Pie/Bar charts |
| Admin state | Zustand | ^4.4.7 | Auth store only |
| Deployment (backend) | Render.com | — | Web service, Singapore region, free plan |
| Deployment (mobile) | EAS Build/Submit | — | Android APK/AAB, Play Store internal track |
| Local orchestration | Docker Compose | — | backend + MongoDB containers |

---

## 5. Project Structure

```
backend/
├── src/
│   ├── server.js              Express app bootstrap, middleware, route mounting, Socket.IO init
│   ├── config/                db.js (Mongo connection), cloudinary.js (Cloudinary SDK config)
│   ├── models/                User, Message, Conversation, Settings, Otp, OtpCode (Mongoose schemas)
│   ├── routes/                auth.js, users.js, conversations.js, messages.js, admin.js
│   ├── middleware/            verifyJWT, isAdmin, checkSettings, rateLimitOtp
│   ├── services/              storage.js, twofactorOtp.js, smsService.js
│   ├── socket/                socketHandler.js (Socket.IO connection & event handling)
│   ├── utils/                 mailer.js, firebaseAdmin.js, sms.js
│   └── scripts/               seedAdmin.js, migrate-avatar-paths.js, migrate-message-file-urls.js, migrate-allowed-mime-types.js
├── uploads/                   Local file storage (dev / fallback only)
├── package.json
└── Dockerfile

mobile/
├── app/                       Expo Router file-based routes
│   ├── _layout.tsx            Root layout — auth hydration & role-based navigation guard
│   ├── (auth)/                login, register, phone-login, phone-register, forgot-password,
│   │                          reset-password, reset-password-phone, verify-otp
│   ├── (user)/                index (chat list), new-chat, profile
│   ├── (admin)/               index, dashboard, users/index, users/[id], settings, profile,
│   │                          new-chat, conversations/index, conversations/[id], files
│   ├── chat/[id].tsx          Chat room screen
│   ├── contact/[id].tsx       Contact detail screen
│   └── group/[id]/settings.tsx Group settings screen
├── components/
│   ├── chat/                  MessageBubble, InputBar, ChatListItem, MessageContextMenu,
│   │                          ForwardPicker, VoiceMessageBubble, ReactionBar, ReactionPicker,
│   │                          TypingIndicator, PinnedBanner, ReadReceipt, ReplyPreview
│   ├── admin/                 AdminActionSheet, StatCard
│   └── ui/                    GlassCard, GlassInput, NeonButton, AvatarWithRing,
│                              FullscreenImageViewer, AnimatedPressable, NeonBadge, OtpInput, PhoneInput
├── store/                     authStore, chatStore, messageStore (Zustand)
├── lib/                       axios.ts, socket.ts, documentViewer.ts, firebase.ts, phoneUtils.ts, pendingAuth.ts
├── hooks/                     useSocket.ts, usePushNotifications.ts
├── constants/                 config.ts (URLs, constants), theme.ts (design system)
├── android/                   Native Android project (gradle.properties, AndroidManifest.xml)
├── app.json, eas.json, package.json

admin/
├── src/
│   ├── App.tsx, main.tsx      Routing & bootstrap
│   ├── theme.ts, constants.ts MUI dark theme, BASE_URL constant
│   ├── pages/                 Login, Dashboard, Users, UserDetail, Conversations,
│   │                          ConversationDetail, Files, Settings
│   ├── components/            ProtectedRoute, Sidebar, StatsCard
│   ├── store/                 adminAuthStore (Zustand)
│   └── lib/                   axios.ts (API client)
├── vite.config.ts, tsconfig.json, package.json, .env / .env.example
```

---

## 6. Database Design

**Database:** MongoDB (Mongoose ODM, 7 collections)

### 6.1 Entity-Relationship Overview

```
┌─────────────┐        members[]         ┌──────────────────┐        conversation       ┌─────────────┐
│    User     │◄─────────────────────────│   Conversation    │◄──────────────────────────│   Message   │
│             │  groupAdmins[], createdBy │                   │  lastMessage, pinnedMsg   │             │
│  pinnedChats│─────────────────────────► │                   │ ─────────────────────────►│  sender     │
│  archivedCha│        (refs)             │  unreadCounts[]   │       (refs)              │  replyTo    │
│  ts[]       │                           │   .user → User    │                           │  reactions[]│
└──────┬──────┘                           └───────────────────┘                           │   .users[]  │
       │                                                                                   │  readBy[]   │
       │            phone / purpose                                                        │ deliveredTo │
       ▼                                                                                   │ deletedFor[]│
┌─────────────┐      ┌─────────────┐                                                       └─────────────┘
│     Otp     │      │   OtpCode    │            ┌──────────────┐
│ (2FA legacy)│      │ (2Factor.in  │            │   Settings    │  (singleton document — global config)
│ TTL-indexed │      │  AUTOGEN)    │            └──────────────┘
└─────────────┘      └─────────────┘
```

### 6.2 Collections (Complete Field Reference)

#### `User`
| Field | Type | Default | Constraints | Notes |
|---|---|---|---|---|
| `displayName` | String | — | required, trimmed | |
| `email` | String | `null` | unique, sparse, lowercase | nullable for phone-only accounts |
| `phone` | String | `null` | unique, sparse | E.164 format |
| `isPhoneVerified` | Boolean | `false` | | OTP verification flag |
| `password` | String | `null` | bcrypt-hashed | nullable for phone-only accounts |
| `avatarUrl` | String | `null` | | Cloudinary URL or relative path |
| `role` | String enum | `'user'` | `'user'` \| `'admin'` | |
| `isBanned` | Boolean | `false` | | admin suspension |
| `pushToken` | String | `null` | | Expo/FCM push token |
| `isOnline` | Boolean | `false` | | live presence flag |
| `lastSeen` | Date | `null` | | |
| `bio` | String | `null` | trimmed | |
| `archivedChats` | [ObjectId → Conversation] | `[]` | | |
| `pinnedChats` | [ObjectId → Conversation] | `[]` | | |
| `createdAt` / `updatedAt` | Date | auto | | timestamps |

Pre-save validation: a user **must** have at least one of `email` or `phone`.

#### `Message`
| Field | Type | Default | Notes |
|---|---|---|---|
| `conversation` | ObjectId → Conversation | required | |
| `sender` | ObjectId → User | required | |
| `type` | String enum | `'text'` | `'text'` \| `'file'` |
| `content` | String | `null` | text body (null for pure file messages) |
| `fileUrl` | String | `null` | Cloudinary URL |
| `fileName` | String | `null` | original filename |
| `fileSize` | Number | `null` | bytes |
| `fileMimeType` | String | `null` | MIME type |
| `replyTo` | ObjectId → Message | `null` | |
| `reactions` | [ `{ emoji: String, users: [ObjectId → User] }` ] | `[]` | sub-document, no `_id` |
| `readBy` | [ObjectId → User] | `[]` | |
| `deliveredTo` | [ObjectId → User] | `[]` | |
| `deletedFor` | [ObjectId → User] | `[]` | per-user "delete for me" |
| `deletedForAll` | Boolean | `false` | |
| `isEdited` | Boolean | `false` | |
| `editedAt` | Date | `null` | |
| `isPinned` | Boolean | `false` | |
| `isForwarded` | Boolean | `false` | |
| `createdAt` / `updatedAt` | Date | auto | |

#### `Conversation`
| Field | Type | Default | Notes |
|---|---|---|---|
| `type` | String enum | required | `'direct'` \| `'group'` |
| `members` | [ObjectId → User] | required | 2 for direct, 2+ for group |
| `groupName` | String | `null` | |
| `groupAvatar` | String | `null` | Cloudinary URL |
| `groupAdmins` | [ObjectId → User] | `[]` | |
| `createdBy` | ObjectId → User | `null` | group creator |
| `lastMessage` | ObjectId → Message | `null` | |
| `pinnedMessage` | ObjectId → Message | `null` | |
| `unreadCounts` | [ `{ user: ObjectId → User, count: Number }` ] | `[]` | per-user unread counters |
| `deletedBy` | [ObjectId → User] | `[]` | per-user soft-delete |
| `createdAt` / `updatedAt` | Date | auto | |

#### `Settings` (singleton)
| Field | Type | Default | Notes |
|---|---|---|---|
| `maxFileSizeMB` | Number | `10` | |
| `fileSharingEnabled` | Boolean | `true` | |
| `registrationEnabled` | Boolean | `true` | |
| `allowedMimeTypes` | [String] | preset list | images, docs, audio, video MIME types |
| `storageAlertMB` | Number | `500` | dashboard warning threshold |

#### `Otp` (legacy 2FA model)
| Field | Type | Notes |
|---|---|---|
| `phone` | String, indexed | required |
| `code` | String | OTP code |
| `purpose` | String enum | `'signup'` \| `'reset'` |
| `expiresAt` | Date, **TTL index** (`expireAfterSeconds: 0`) | auto-deletes |
| `used` | Boolean (`false`) | replay protection |

Indexes: `{ expiresAt: 1 }` (TTL), `{ phone: 1, purpose: 1 }` (compound)

#### `OtpCode` (active 2Factor.in model)
| Field | Type | Notes |
|---|---|---|
| `phone` | String | trimmed |
| `sessionId` | String | returned by 2Factor.in |
| `purpose` | String enum | `'register'` \| `'login'` \| `'forgot_password'` |
| `expiresAt` | Date, **TTL index** | auto-deletes |
| `isUsed` | Boolean (`false`) | replay protection |
| `attempts` | Number (`0`) | verification attempt counter |

Indexes: `{ expiresAt: 1 }` (TTL), `{ phone: 1, purpose: 1 }` (compound)

---

## 7. Authentication Flow

MessCast supports **three parallel authentication mechanisms**, selectable per-flow and globally gated by `OTP_PROVIDER`:

### 7.1 Email + Password
1. `POST /api/auth/register` → creates account (gated by `checkSettings('registrationEnabled')`) → returns `{ token, user }`
2. `POST /api/auth/login` → validates credentials with bcrypt → returns `{ token, user }`
3. Forgot password: `POST /api/auth/forgot-password` (sends SMTP email with 1-hour JWT reset link) → `POST /api/auth/reset-password`

### 7.2 Phone + OTP (2Factor.in — `OTP_PROVIDER=twofactor`, default)
1. `POST /api/auth/send-otp` (rate-limited: max 3/hour per phone+purpose) → `twofactorOtp.sendOtp()` calls 2Factor.in AUTOGEN endpoint, stores `OtpCode` document with `sessionId`
2. `POST /api/auth/verify-otp` → verifies against 2Factor.in VERIFY endpoint → issues a 15-minute `verificationToken`
3. `POST /api/auth/phone-register` → consumes `verificationToken`, creates account (gated by `registrationEnabled`)
4. `POST /api/auth/phone-login` → password-based login thereafter (OTP only required once, at signup)
5. Forgot password (phone): `POST /api/auth/forgot-password/verify` → 15-minute `resetToken` → `POST /api/auth/reset-password-phone`

### 7.3 Firebase Phone Authentication (`OTP_PROVIDER=firebase`)
1. Mobile app handles OTP natively via the Firebase SDK (`mobile/lib/firebase.ts`)
2. `POST /api/auth/firebase-phone-login` — backend verifies the Firebase `idToken` via `firebaseAdmin.verifyFirebaseToken()`, extracts `phone_number`, issues JWT
3. `POST /api/auth/firebase-phone-register` — same verification + account creation (gated by `registrationEnabled`)
4. `POST /api/auth/firebase-phone-forgot` — verifies phone ownership, issues 15-minute `resetToken`

**Feature flag behavior:** when `OTP_PROVIDER=firebase`, the `/send-otp` and `/verify-otp` endpoints return HTTP 503.

### 7.4 Token Lifecycle
- All login/register endpoints return `{ token, user: { id, role, displayName, avatarUrl, email, phone } }`
- JWT signed with `JWT_SECRET`, valid 30 days
- `verifyJWT` middleware validates `Authorization: Bearer <token>` on every protected route, populates `req.user`
- Mobile/Admin clients persist the token (AsyncStorage / localStorage) and attach it via Axios request interceptors
- Socket.IO connections authenticate via `{ auth: { token } }` in the handshake
- Banned users are force-disconnected in real time via the `force_logout` socket event (`{ reason: 'banned' }`) sent to their personal room `user_{userId}`

---

## 8. API Documentation (Complete)

All protected routes require `Authorization: Bearer <JWT>` unless noted. Base URL in production: `https://messcast-1.onrender.com` (configured via `EXPO_PUBLIC_API_URL` / `VITE_API_URL`).

### 8.1 Authentication — `/api/auth` (public)

| Method | Route | Purpose | Body | Response |
|---|---|---|---|---|
| POST | `/register` | Email/password signup | `{ displayName, email, password }` | `201 { token, user }` |
| POST | `/login` | Email/password login | `{ email, password }` | `200 { token, user }` |
| POST | `/forgot-password` | Request reset email | `{ email }` | `200 { message }` |
| POST | `/reset-password` | Complete email reset | `{ token, newPassword }` | `200 { message }` |
| POST | `/send-otp` | Send SMS OTP (rate-limited) | `{ phone, purpose }` | `200 { message }` (503 if Firebase mode) |
| POST | `/verify-otp` | Verify SMS OTP | `{ phone, code, purpose }` | `200 { message, verificationToken }` |
| POST | `/phone-register` | Register via phone+OTP | `{ phone, displayName, email?, password, verificationToken }` | `201 { token, user }` |
| POST | `/phone-login` | Phone + password login | `{ phone, password }` | `200 { token, user }` |
| POST | `/forgot-password/verify` | Verify OTP for reset | `{ phone, verificationToken }` | `200 { message, resetToken }` |
| POST | `/reset-password-phone` | Set new password (phone) | `{ resetToken, newPassword }` | `200 { message }` |
| POST | `/firebase-phone-login` | Firebase phone login | `{ idToken }` | `200 { token, user }` |
| POST | `/firebase-phone-register` | Firebase phone signup | `{ idToken, displayName }` | `201 { token, user }` |
| POST | `/firebase-phone-forgot` | Firebase reset request | `{ idToken }` | `200 { message, resetToken }` |

### 8.2 Users — `/api/users` (auth required)

| Method | Route | Purpose | Body | Response |
|---|---|---|---|---|
| GET | `/search?q=&exclude=` | Search users (limit 20) | — | `[{ id, displayName, email, avatarUrl, isOnline, lastSeen }]` |
| GET | `/me` | Current profile | — | User (no password) |
| PATCH | `/me` | Update profile | `{ displayName?, email?, bio? }` | Updated User |
| POST | `/avatar` | Upload avatar (multipart, ≤5 MB, image only) | `avatar: file` | `{ avatarUrl }` |
| PATCH | `/me/password` | Change password | `{ currentPassword, newPassword }` | `{ success: true }` |
| PATCH | `/me/push-token` | Register push token | `{ token }` | `{ success: true }` |
| GET | `/:id` | Public profile | — | `{ id, displayName, avatarUrl, email, phone, bio, isOnline, lastSeen }` |

### 8.3 Conversations — `/api/conversations` (auth required)

| Method | Route | Purpose | Body | Response / Notes |
|---|---|---|---|---|
| GET | `/` | List active conversations | — | sorted by `updatedAt` desc, excludes archived/soft-deleted |
| GET | `/archived` | List archived | — | |
| GET | `/pinned` | List pinned | — | |
| POST | `/` | Create conversation | `{ type, members, groupName?, groupAvatar? }` | `201`; checks for existing direct chat |
| GET | `/:id` | Get details | — | members populated |
| PATCH | `/:id/group` | Update group name/avatar | `{ groupName?, groupAvatar? }` | group admin / app admin only |
| POST | `/:id/members` | Add member | `{ userId }` | emits `member_added` |
| DELETE | `/:id/members/:userId` | Remove member | — | self-removal always allowed; emits `member_removed` |
| PATCH | `/:id/admins` | Promote/demote | `{ userId, action }` | creator / app admin only |
| POST | `/:id/pin` | Toggle pin | — | `{ isPinned }` |
| POST | `/:id/archive` | Toggle archive | — | `{ isArchived }` |
| DELETE | `/:id` | Soft-delete | — | adds to `deletedBy` |
| GET | `/:id/pinned-message` | Get pinned message | — | `{ pinnedMessage }` |
| POST | `/:id/avatar` | Upload group avatar (≤5 MB, image) | `avatar: file` | group admin only |

### 8.4 Messages — `/api/messages` (auth required)

| Method | Route | Purpose | Body | Notes |
|---|---|---|---|---|
| GET | `/:conversationId?page=&limit=` | Paginated messages (limit 50) | — | excludes `deletedForAll` & own `deletedFor` |
| POST | `/text` | Send text | `{ conversationId, content, replyTo? }` | emits `new_message`, sends push |
| POST | `/file` | Upload + send file (multipart) | `file` + `{ conversationId, replyTo? }` | dynamic size/MIME limits from `Settings`; emits `new_message`, sends push |
| POST | `/forward` | Forward message(s) | `{ messageId, conversationIds: [] }` | copies content/file, marks `isForwarded` |
| PATCH | `/:id/read` | Mark read | — | updates `readBy` & unread counters |
| PATCH | `/:id/delivered` | Mark delivered | — | emits `message_delivered` |
| POST | `/bulk-read` | Mark all read | `{ conversationId }` | |
| PATCH | `/:id` | Edit (text only, sender only) | `{ content }` | sets `isEdited`, `editedAt`; emits `message_edited` |
| DELETE | `/:id` | Delete | `{ deleteFor: 'me'\|'everyone' }` | "everyone" limited to sender/admin within 15 min; emits `message_deleted` |
| POST | `/:id/react` | Add/toggle reaction | `{ emoji }` | allowed: 👍 ❤️ 😂 😮 😢 🙏; no self-reactions; emits `reaction_updated` |
| POST | `/:id/pin` | Pin message | — | admin/group-admin/direct-chat only; emits `message_pinned` |
| DELETE | `/:id/pin` | Unpin | — | emits `message_unpinned` |
| GET | `/:conversationId/search?q=` | Search (text, limit 50) | — | case-insensitive |

### 8.5 Admin — `/api/admin` (auth + `isAdmin` required)

**Statistics**
| Method | Route | Response |
|---|---|---|
| GET | `/stats` | `{ totalUsers, totalMessages, totalFiles, totalConversations, storageUsedMB, bannedUsers, activeToday }` |
| GET | `/stats/messages` | `[{ _id: 'YYYY-MM-DD', count }]` (30 days) |
| GET | `/stats/files` | `[{ _id: mimeType, count }]` |
| GET | `/stats/registrations` | `[{ _id: 'YYYY-MM-DD', count }]` (30 days) |

**User management**
| Method | Route | Body | Notes |
|---|---|---|---|
| GET | `/users?search=&role=&isBanned=&page=&limit=` | — | default `limit=20` |
| GET | `/users/:id` | — | `{ user, msgCount, fileCount, groups }` |
| PATCH | `/users/:id` | `{ displayName?, email? }` | |
| PATCH | `/users/:id/ban` | — | toggles; emits `force_logout` if banned |
| PATCH | `/users/:id/role` | `{ role }` | |
| PATCH | `/users/:id/password` | `{ password }` | min 8 chars |
| DELETE | `/users/:id` | — | deletes user + all messages + files |

**Conversation management**
| Method | Route | Notes |
|---|---|---|
| GET | `/conversations?type=&page=&limit=` | |
| GET | `/conversations/:id/messages?page=&limit=` | |
| DELETE | `/conversations/:id` | deletes all messages + files |
| PATCH | `/conversations/:id/members` | `{ userId }` — emits `member_removed` |

**Message / file management**
| Method | Route | Notes |
|---|---|---|
| DELETE | `/messages/:id` | cleans up associated file |
| GET | `/files?fileType=&uploader=&from=&to=&page=&limit=` | filter by MIME, uploader, date range |
| DELETE | `/files/:messageId` | nulls file fields, keeps message |

**Broadcast & Settings**
| Method | Route | Body | Notes |
|---|---|---|---|
| POST | `/broadcast` | `{ content }` | sends DM to every non-banned, non-admin user; emits `new_message` |
| GET | `/settings` | — | creates default `Settings` doc if absent |
| PATCH | `/settings` | any `Settings` fields | |

### 8.6 Health
`GET /health` → `{ status: 'ok', storageProvider: 'cloudinary' | 'local' }` (used by Render's health check)

---

## 9. Real-time Features (Socket.IO)

**File:** `backend/src/socket/socketHandler.js`

**Connection handshake:** client passes `{ token }` in `socket.auth`; middleware verifies the JWT, joins the user to a personal room `user_{userId}`, sets `isOnline = true`, clears `lastSeen`, and broadcasts presence to all of the user's conversation rooms. On disconnect, marks the user offline and stamps `lastSeen`.

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `join_conversation` / `leave_conversation` | client→server | `conversationId` | room subscription |
| `typing` / `stop_typing` | client↔server↔room | `{ conversationId, user }` / `{ conversationId, userId }` | typing indicators |
| `user_online` / `user_offline` | server→room | `{ userId }` / `{ userId, lastSeen }` | presence broadcast |
| `new_message` | server→room | populated Message | new message |
| `message_read` | server→room | `{ messageId, userId, conversationId }` | read receipt |
| `message_delivered` | server→room | `{ messageId, userId }` | delivery receipt |
| `message_edited` | server→room | populated Message | edit broadcast |
| `message_deleted` | server→room | `{ messageId, conversationId, deletedForAll }` | deletion broadcast |
| `reaction_updated` | server→room | `{ messageId, reactions }` | reaction changes |
| `message_pinned` / `message_unpinned` | server→room | `{ conversationId, message }` / `{ conversationId }` | pin state |
| `member_added` / `member_removed` | server→room | `{ conversationId, userId }` | group membership |
| `force_logout` | server→user (`user_{userId}`) | `{ reason: 'banned' }` | forced disconnection on ban |

**Server config:** `pingTimeout: 60000ms`, `pingInterval: 25000ms`, CORS origins from comma-separated `CLIENT_URLS` (or `*`).

**Mobile consumption:** the global `useSocket()` hook (`mobile/hooks/useSocket.ts`) subscribes to all events once authenticated, dispatching into the Zustand `chatStore`/`messageStore`; the chat-room screen additionally manages `join_conversation`/`leave_conversation`/`typing` locally.

---

## 10. File Storage

**Architecture:** an abstraction layer (`backend/src/services/storage.js`) supports two interchangeable providers, selected via `STORAGE_PROVIDER`:

| Provider | Used when | Mechanism |
|---|---|---|
| `cloudinary` (production default) | `STORAGE_PROVIDER=cloudinary` | Multer **memory** storage → `cloudinary.uploader.upload_stream` → returns full HTTPS CDN URL stored directly in MongoDB. Auto-detects `resource_type` (`image`/`video`/`raw`); PDFs/documents use `raw` for public delivery. Public ID format: `${Date.now()}_${random}`. |
| `local` (dev fallback) | `STORAGE_PROVIDER=local` | Multer **disk** storage to `backend/uploads/<folder>/`; filenames `${Date.now()}_${random}.${ext}`; served statically at `/uploads`; URL built from `BASE_URL`. **Not persistent** on Render (ephemeral filesystem) — this is why the project migrated to Cloudinary (commit `eec27cd`). |

**Exported service functions:** `multerStorage(folder?)`, `uploadFile(file, folder?) → URL`, `deleteFile(publicUrl)`, `getPublicUrl(storedValue)`.

**Cloud account:** `CLOUDINARY_CLOUD_NAME=dntjzcrdp` (set directly in `render.yaml`); API key/secret set as private Render env vars.

**Migration scripts** (one-time, run manually): `migrate-avatar-paths.js` and `migrate-message-file-urls.js` clear stale `/uploads/...` paths left over from the pre-Cloudinary era.

**Settings-driven limits:** `Settings.maxFileSizeMB` (default 10 MB) and `Settings.allowedMimeTypes` (configurable allow-list of image/document/audio/video MIME types) gate every upload via `checkSettings('fileSharingEnabled')` and dynamic Multer limits.

**Mobile native document viewer** (`mobile/lib/documentViewer.ts`, added in commit `5fc8311`):
- Detects MIME type from server-provided `fileMimeType` with a file-extension fallback table (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, JSON, CSV)
- Downloads and **caches** the file locally under `${FileSystem.cacheDirectory}documents/`, content-addressed by sanitized filename, with a 7-day staleness cleanup run once per app session (`cleanDocumentCacheOnce`)
- **Android:** converts the cached `file://` URI to a `content://` URI via `FileSystem.getContentUriAsync` (backed by Expo's auto-merged `FileProvider` manifest entries) and launches `android.intent.action.VIEW` with `FLAG_GRANT_READ_URI_PERMISSION` (flag value `1`) and the resolved MIME type — this opens the OS's native "Open with…" chooser (Word, Excel, PowerPoint, PDF readers, etc.), exactly like WhatsApp
- **iOS:** uses `expo-sharing`'s `shareAsync` to present the share sheet's "Open in…" row (the closest iOS equivalent, since iOS has no public `ACTION_VIEW`-style API)
- Throws a typed `NoViewerAppError` when no compatible app is installed, which the UI (`MessageBubble.tsx`) catches and presents an alert offering **Share** or **Open in Browser** fallbacks
- **Voice messages** use a separate playback path (`VoiceMessageBubble.tsx`) via `expo-av`'s `Audio.Sound`, with a single shared sound instance, animated progress bar (Reanimated), and play/pause/duration display

---

## 11. Mobile Application

**Framework:** Expo SDK 54 (managed workflow, New Architecture + Hermes enabled, edge-to-edge display), React Native 0.81, Expo Router 6 with typed routes, TypeScript.

### 11.1 Navigation Structure
Root layout (`app/_layout.tsx`) hydrates auth state from AsyncStorage and routes based on role:
- Unauthenticated → `(auth)` stack (fade transition)
- `role: 'admin'` → `(admin)` tab group
- `role: 'user'` → `(user)` tab group

### 11.2 Screen Inventory

| Screen | Path | Purpose | Key API Calls |
|---|---|---|---|
| Login | `(auth)/login.tsx` | Email/password sign-in | `POST /auth/login` |
| Register | `(auth)/register.tsx` | Email signup | `POST /auth/register` |
| Phone Login / Register | `(auth)/phone-login.tsx`, `phone-register.tsx` | Phone+OTP flows | `/auth/send-otp`, `/verify-otp`, `/phone-login`, `/phone-register` |
| Forgot/Reset Password | `forgot-password.tsx`, `reset-password.tsx`, `reset-password-phone.tsx` | Recovery flows | `/auth/forgot-password*`, `/auth/reset-password*` |
| Verify OTP | `verify-otp.tsx` | OTP entry | `/auth/verify-otp` |
| Chat List (User) | `(user)/index.tsx` | Conversations w/ filters (All/Unread/Groups/Archived), pin/archive/delete, search | `GET /conversations`, `/archived`, `POST .../pin`, `/archive`, `DELETE /conversations/:id` |
| New Chat | `(user)/new-chat.tsx` | Direct or group creation, member search, avatar upload | `GET /users/search`, `POST /conversations`, `POST .../avatar` |
| Profile (User) | `(user)/profile.tsx` | Avatar/name edit, password change, sign out | `POST /users/avatar`, `PATCH /users/me`, `PATCH /users/me/password` |
| Admin Chat List | `(admin)/index.tsx` | Same as user list, admin styling | `GET /conversations`, pin/archive |
| Dashboard | `(admin)/dashboard.tsx` | Stat grid + 7-day bar chart | `GET /admin/stats`, `/admin/stats/messages` |
| Users List | `(admin)/users/index.tsx` | Search, ban toggle, message user | `GET /admin/users`, `PATCH .../ban` |
| User Detail | `(admin)/users/[id].tsx` | Profile, stats, ban/promote/delete | `GET /admin/users/:id`, `PATCH .../ban`, `/role`, `DELETE` |
| Admin Settings | `(admin)/settings.tsx` | Global feature toggles, MIME allow-list | `GET/PATCH /admin/settings` |
| Chat Room | `chat/[id].tsx` | Real-time messaging UI (see §11.3) | `GET /messages/:id`, `POST .../bulk-read`, reactions, pin, edit, delete, search + full Socket.IO event set |
| Contact Detail | `contact/[id].tsx` | View contact's profile | `GET /users/:id` |
| Group Settings | `group/[id]/settings.tsx` | Manage name/avatar/members/admins, leave/delete | `PATCH /conversations/:id`, `POST/DELETE .../members`, `PATCH .../admins`, `POST .../avatar` |

### 11.3 Chat Room — Detailed Feature Set
- Header with presence (Online / Offline / Last seen / member count), search toggle
- Pinned-message banner with scroll-to and unpin
- Paginated message list (50/page) with date separators, sender grouping, `maintainVisibleContentPosition` to preserve scroll position during pagination
- Message bubbles: text, file/document cards (WhatsApp-style: icon, filename, "TYPE • size", "Tap to open"), images (with retry/fallback), voice notes (waveform-style progress, play/pause)
- Long-press context menu: Reply, Forward, Edit (sender, text-only), Copy, Pin, Delete-for-me, Delete-for-everyone (15-minute window), 6-emoji reaction picker
- Swipe-right gesture to quick-reply (Reanimated spring physics)
- Typing indicators, read/delivery receipt avatars, online presence dots
- Local + server-side (debounced, 2+ chars) message search with highlight & scroll-to-result
- Input bar: auto-expanding text field, image/document picker, hold-to-record voice notes with slide-to-cancel, reply/edit preview banners

### 11.4 State Management (Zustand Stores)
- **`authStore`** — `{ user, token, isHydrated }`; persists to AsyncStorage (`authToken`, `authUser`); `setUser`, `logout`, `hydrate`, `updateUser`
- **`chatStore`** — conversations/archived lists, `pinnedIds`/`archivedIds` Sets, sorting (pinned-first then by `updatedAt`), member presence sync
- **`messageStore`** — per-conversation message arrays, typing-user lists, reply targets; de-duplicating `addMessage`/`prependMessages` to avoid socket-echo duplicates

### 11.5 Lib & Hooks
- `lib/axios.ts` — Axios instance, JWT interceptor, normalized error messages, `BASE_URL` fallback `https://messcast-1.onrender.com`
- `lib/socket.ts` — Socket.IO singleton (`getSocket`, `connectSocket`, `disconnectSocket`), websocket-only transport
- `lib/documentViewer.ts` — native document opening engine (see §10)
- `lib/firebase.ts` — Firebase config from `EXPO_PUBLIC_FIREBASE_*` env vars
- `lib/phoneUtils.ts`, `lib/pendingAuth.ts` — phone formatting/validation, transient OTP-flow state
- `hooks/useSocket.ts` — global real-time event subscription wired into Zustand stores
- `hooks/usePushNotifications.ts` — push notification registration

### 11.6 Design System (`constants/theme.ts`)
Dark glassmorphic/neon theme: background layers (`#0A0A0F` base), glass surfaces with blur, accent colors `primary` (#7C5CFC purple) / `secondary` (#00D4FF cyan), spacing/radius/font scales, neon glow shadows.

### 11.7 Configuration
- **`app.json`**: name `MessCast`, scheme `messcast`, package/bundle ID `com.messcast.app`, dark UI style, Android permissions (`RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`, `MODIFY_AUDIO_SETTINGS`), plugins (`expo-router`, `expo-system-ui`, `expo-notifications`, `expo-image-picker`, `expo-av`), `typedRoutes: true`, EAS project ID `9b80a82d-2af4-40b8-a2fb-943a4342fdc9`
- **`eas.json`**: build profiles `development` (APK, dev client), `preview` (APK, staging env), `production` (AAB, prod env); `submit.production.android` configured for Google Play internal track via `google-services-key.json`
- **`android/gradle.properties`**: New Architecture enabled, Hermes enabled, `edgeToEdgeEnabled=true` (this setting breaks `windowSoftInputMode="adjustResize"`, requiring JS-level `KeyboardAvoidingView` keyboard handling — addressed in commit `ebb913e`)

---

## 12. Admin Panel

**Stack:** React 18 + Vite 5 + TypeScript + MUI 5 (dark theme) + MUI X DataGrid + Recharts + Zustand + React Router 6 + Axios + react-toastify.

### 12.1 Routes & Pages

| Page | Route | Purpose | Key API Calls |
|---|---|---|---|
| Login | `/login` | Admin sign-in (role-gated) | `POST /auth/login` |
| Dashboard | `/` | Stat cards + line/pie/bar charts (users, messages, files, conversations, storage, bans, registrations) | `GET /admin/stats*` (4 endpoints) |
| Users | `/users` | Searchable/filterable DataGrid, edit/ban/delete | `GET /admin/users`, `PATCH .../ban`, `PATCH /admin/users/:id`, `DELETE` |
| User Detail | `/users/:id` | Profile, stats, ban/promote/delete with confirmation dialogs | `GET /admin/users/:id`, `PATCH .../ban`, `/role`, `DELETE` |
| Conversations | `/conversations` | Filterable list (direct/group), delete | `GET /admin/conversations`, `DELETE /admin/conversations/:id` |
| Conversation Detail | `/conversations/:id` | Message list, per-message & whole-conversation deletion | `GET .../messages`, `DELETE /admin/messages/:id`, `DELETE /admin/conversations/:id` |
| Files | `/files` | Storage meter (progress bar, alerts at >80%), filterable file table, download/delete | `GET /admin/files`, `GET /admin/stats`, `DELETE /admin/files/:id` |
| Settings | `/settings` | Global config: max file size, storage alert, feature toggles, 17 MIME-type checkboxes | `GET/PATCH /admin/settings` |

### 12.2 Architecture Notes
- **Routing:** `ProtectedRoute` component gates all routes except `/login`, redirecting non-admins
- **Layout:** persistent `Sidebar` (240px, 5 nav items + user profile/logout) + content area
- **State:** `adminAuthStore` (Zustand) — `{ user, token }`, persisted to `localStorage` (`adminToken`, `adminUser`), with `login`/`logout`/`hydrate`
- **API client:** `lib/axios.ts` — JWT interceptor + 401 handler that clears storage and redirects to `/login`
- **Theme:** dark MUI theme matching mobile's neon palette (`#7C5CFC` primary, `#00D4FF` secondary, `#0A0A0F`/`#13131F` backgrounds)
- **Dev server:** Vite on port 3000, proxying `/api` and `/uploads` to `http://localhost:5000`
- **Env:** `VITE_API_URL` (e.g., `http://192.168.0.174:5000` in dev) — only `VITE_`-prefixed vars are exposed client-side

---

## 13. Security Implementation

| Mechanism | Implementation |
|---|---|
| Transport security | Helmet (HTTP headers), CORS restricted to `CLIENT_URLS` origins, `cross-origin` resource policy |
| Authentication | JWT (`jsonwebtoken`, `JWT_SECRET`, 30-day expiry), `verifyJWT` middleware on all protected routes |
| Password storage | bcrypt hashing (`bcryptjs`) |
| Authorization | `isAdmin` middleware gating all `/api/admin/*` routes; route-level checks for group-admin/creator/sender permissions |
| Rate limiting | `rateLimitOtp` — max 3 OTP requests per phone+purpose per hour |
| Replay protection | `used`/`isUsed` flags + `attempts` counters on OTP documents; TTL indexes auto-expire OTP records |
| OTP verification tokens | Short-lived (15-minute) JWTs scoped to a single verification/reset action |
| Input validation | Mongoose schema validation (`required`, `enum`, `unique`, `trim`), pre-save hooks (User must have email or phone) |
| File-upload limits | Dynamic MIME allow-list and max-size enforcement from the `Settings` singleton, Multer `LIMIT_FILE_SIZE` → HTTP 413 |
| Forced session termination | `force_logout` Socket.IO event disconnects banned users immediately |
| Compression / logging | `compression` (gzip), `morgan` (combined in production, dev format otherwise) |
| Secrets management | All credentials (`JWT_SECRET`, `MONGO_URI`, Cloudinary, SMTP, Twilio, Firebase, 2Factor) supplied via environment variables — `sync: false` in `render.yaml` (never committed) |

---

## 14. Deployment

### 14.1 Backend (Render.com — `render.yaml`)
- Service `messcast-backend`, type **web**, environment **Node.js**, region **Singapore**, plan **Free**
- Root directory: `backend/`; Build: `npm install`; Start: `node src/server.js`
- Health check path: `/health`
- Production env vars set via Render dashboard (sensitive ones marked `sync: false`): `MONGO_URI`, `JWT_SECRET`, `BASE_URL`, `CLIENT_URLS`, `STORAGE_PROVIDER=cloudinary`, `CLOUDINARY_CLOUD_NAME=dntjzcrdp`, `CLOUDINARY_API_KEY/SECRET`, `STORAGE_ALERT_MB=500`, `APP_SCHEME=messcast`, `OTP_PROVIDER=twofactor`, `OTP_DEV_BYPASS=false`, `TWOFACTOR_API_KEY`, SMTP credentials, Firebase Admin credentials

### 14.2 Local Development (`docker-compose.yml`)
- `backend` service: built from `./backend`, port `5000:5000`, mounts `./backend/uploads`, loads `./backend/.env`, depends on `mongo`
- `mongo` service: `mongo:6` image, port `27017:27017`, persistent named volume `mongo_data`

### 14.3 Mobile (EAS Build / Submit)
- Build profiles in `eas.json`: `development` (debug APK + dev client), `preview` (internal APK, staging URLs), `production` (AAB for Play Store, production env vars)
- Submit profile targets Google Play **internal track** via service-account key `google-services-key.json`
- Native Android project checked in at `mobile/android/`; New Architecture + Hermes + edge-to-edge enabled

### 14.4 Admin Panel
- Vite production build (`npm run build`) emits static assets to `admin/dist/`; deployable to any static host (Render static site, Netlify, etc.) with `VITE_API_URL` pointed at the production backend

### 14.5 Environment Variable Reference (Backend — from `.env.example`)
`PORT`, `MONGO_URI`, `JWT_SECRET`, `STORAGE_ALERT_MB`, `NODE_ENV`, `BASE_URL`, `CLIENT_URLS`, `STORAGE_PROVIDER`, `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`, `APP_SCHEME`, `OTP_PROVIDER`, `TWOFACTOR_API_KEY`, `OTP_DEV_BYPASS`, `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`, `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`

---

## 15. Current Features — Status Matrix

| Feature | Status | Notes |
|---|---|---|
| Email/password auth (register, login, reset) | ✅ Completed | Full flow incl. SMTP email reset |
| Phone OTP auth (2Factor.in) | ✅ Completed | Rate-limited, session-based verification |
| Firebase phone auth | ✅ Completed | Alternate provider, selectable via `OTP_PROVIDER` |
| One-to-one chat | ✅ Completed | |
| Group chat (create, manage, roles) | ✅ Completed | Creator/admin/member role hierarchy |
| Real-time messaging (Socket.IO) | ✅ Completed | Full event set incl. presence, typing, receipts |
| Text messages (send/edit/delete) | ✅ Completed | 15-min edit/delete-for-everyone window |
| File/image/document sharing | ✅ Completed | Cloudinary-backed, dynamic size/MIME limits |
| Native document viewer (Open in Word/Excel/PDF/etc.) | ✅ Completed | Commit `5fc8311` — `ACTION_VIEW` intents + caching + fallback UX |
| Voice messages | ✅ Completed | Record (hold + slide-cancel), playback w/ progress |
| Reactions (6 emoji) | ✅ Completed | No self-reactions |
| Replies & forwarding | ✅ Completed | |
| Message pinning | ✅ Completed | Admin/group-admin/direct-only |
| Read & delivery receipts | ✅ Completed | Avatar-based UI |
| Typing indicators & online presence | ✅ Completed | |
| Push notifications | ✅ Completed | Token registration + send-on-new-message |
| Conversation pin/archive/search/delete | ✅ Completed | |
| Message search (local + server) | ✅ Completed | Debounced server fallback |
| Admin dashboard & analytics (mobile + web) | ✅ Completed | Stats, 30-day charts (web), 7-day chart (mobile) |
| Admin user management (ban/promote/edit/delete) | ✅ Completed | |
| Admin conversation/message moderation | ✅ Completed | |
| Admin file/storage monitoring | ✅ Completed | Storage meter w/ alert threshold |
| Admin global settings (feature flags, MIME allow-list, size limits) | ✅ Completed | |
| Admin broadcast messaging | ✅ Completed | Sends DM to all non-banned, non-admin users |
| Cloudinary migration (from local disk) | ✅ Completed | Commit `eec27cd`; migration scripts included |
| Forced logout on ban | ✅ Completed | Real-time socket event |
| Two-factor / legacy Twilio SMS | 🟡 Partial | `smsService`/`sms.js` retained for welcome SMS only; OTP fully on 2Factor.in/Firebase |
| iOS build/release | 🟡 Partial | `ios.bundleIdentifier` configured; no evidence of iOS-specific build pipeline beyond Expo defaults; EAS profiles target Android only |
| Push notification provider finalization | 🟡 Partial | Both Expo and Firebase paths present (`usePushNotifications`, `firebase.ts`) — exact provider selection not fully traced |
| End-to-end encryption | ⚪ Planned (not present) | No evidence of E2EE in models or transport |
| Message translation / AI features | ⚪ Planned (not present) | Not found in codebase |

---

## 16. Performance Analysis

**Strengths observed in the codebase:**
- Pagination everywhere it matters: messages (50/page), admin user/conversation/file lists (20/page), with `maintainVisibleContentPosition` on the mobile FlatList to avoid scroll-jumps during upward pagination
- Per-conversation message storage in Zustand (`messagesByConversation`) avoids loading the entire message corpus into memory
- Local document caching (content-addressed, 7-day TTL cleanup) avoids repeat downloads of the same Cloudinary asset
- gzip compression (`compression` middleware) and CDN-backed media delivery (Cloudinary) reduce backend bandwidth load
- Debounced search inputs (300ms user search, 500ms message search) reduce request volume
- Socket.IO room-based broadcasting (per-conversation and per-user rooms) avoids global broadcast overhead
- `react-native-reanimated` worklets keep gesture/animation work off the JS thread

**Potential concerns / risk areas:**
- **Render free plan**: the backend is hosted on Render's free tier (Singapore region) — subject to cold starts/sleep after inactivity, which will add latency to the first request and to Socket.IO reconnections
- **MongoDB indexes**: only `User` (email/phone, sparse unique), and the `Otp`/`OtpCode` collections have explicit indexes; `Message` and `Conversation` have no compound indexes declared on `conversation`/`members`/`createdAt`, which may slow large-scale message pagination and conversation lookups as data grows
- **`storageUsedMB`** in admin stats is computed from stored `fileSize` values — accuracy depends on every upload populating `fileSize` correctly
- **In-memory Socket.IO state**: presence and room membership are held in the single Node.js process; horizontal scaling would require a Socket.IO adapter (e.g., Redis) not currently present
- **Polling-free design**: the app is fully event-driven (no visible polling loops), which is good for battery/bandwidth on mobile

---

## 17. Bugs and Limitations

Based on code-level evidence (comments, recent fix commits, and architecture review):

1. **Edge-to-edge Android display breaks `adjustResize`** — `gradle.properties: edgeToEdgeEnabled=true` prevents the OS from automatically resizing the view when the keyboard opens; the app now compensates at the JS level with `KeyboardAvoidingView behavior="height"` (fixed in commit `ebb913e`, confirmed correct after an earlier wrong assumption about double-adjustment)
2. **Remote document URLs cannot be opened directly** — `Linking`/`WebBrowser` are browser-class APIs and cannot hand off to native Office/PDF apps from an `https://` URL; this required building a full download-cache-then-`ACTION_VIEW` pipeline (fixed in commit `5fc8311`)
3. **Voice playback instability from concurrent `Audio.Sound` instances** — code comment in `VoiceMessageBubble.tsx` notes that creating a second "probe" sound caused audio-session conflicts; resolved by sharing a single `Audio.Sound` instance for both duration display and playback
4. **Legacy storage migration debt** — three one-time migration scripts (`migrate-avatar-paths.js`, `migrate-message-file-urls.js`, `migrate-allowed-mime-types.js`) exist specifically to clean up data from the pre-Cloudinary local-storage era; any environment that hasn't run them may still contain stale `/uploads/...` URLs
5. **Twilio/legacy SMS code retained but largely unused** — `smsService.js`/`sms.js` and the `Otp` model represent a superseded OTP path (now handled by 2Factor.in/Firebase); kept only for "welcome SMS," representing minor dead-weight/maintenance burden
6. **Free-tier hosting** — Render's free plan can sleep on inactivity, causing perceptible cold-start delays for the first request after idle periods (impacts both REST latency and Socket.IO reconnect time)
7. **No explicit database indexes on `Message.conversation` or `Conversation.members`** — as the dataset grows, paginated message/conversation queries may need compound indexes for continued performance
8. **No automated test suite found** — no `__tests__`, `*.test.*`, or testing framework dependency was observed in any of the three `package.json` files; correctness currently relies on manual QA

---

## 18. Future Enhancements

### Short-term (weeks)
- Add MongoDB compound indexes (`{ conversation: 1, createdAt: -1 }` on `Message`; `{ members: 1, updatedAt: -1 }` on `Conversation`) to keep pagination fast as data grows
- Add an automated test suite (unit tests for routes/services/models; component tests for mobile/admin)
- Remove or formally deprecate the legacy Twilio/`Otp`-model code path once confirmed unused in production
- Expand the document-viewer's MIME/extension table (e.g., RTF, ODT, ODS) and add automated format-coverage tests

### Medium-term (months)
- Move Socket.IO presence/room state to a shared adapter (e.g., `socket.io-redis`) to enable horizontal scaling beyond a single Node.js process
- Upgrade the Render plan (or migrate hosting) to eliminate free-tier cold starts
- Build out an iOS release pipeline (currently only Android EAS profiles are configured, despite `ios.bundleIdentifier` being present in `app.json`)
- Add end-to-end or integration tests covering the Socket.IO real-time flows (message delivery, presence, typing)
- Introduce structured application logging/monitoring (e.g., centralized log aggregation, APM) beyond Morgan's request logs

### Long-term (quarters+)
- Evaluate end-to-end encryption for message content (currently transmitted/stored in plaintext in MongoDB)
- Add message translation / AI-assisted features (smart replies, summarization)
- Multi-region deployment and CDN strategy for the backend (beyond Cloudinary's media CDN) to reduce latency for a geographically distributed user base
- Web client (beyond the admin panel) for end-users, reusing the existing REST/Socket.IO backend

---

## 19. Package Analysis

### Backend (`backend/package.json`)
| Package | Purpose |
|---|---|
| express, cors, helmet, compression, morgan | HTTP server, security headers, gzip, logging |
| socket.io | Real-time WebSocket server |
| mongoose | MongoDB ODM |
| jsonwebtoken, bcryptjs | JWT auth, password hashing |
| multer | Multipart file upload handling |
| cloudinary | Cloud media storage/CDN |
| firebase-admin | Firebase phone-auth token verification |
| nodemailer | SMTP email (password reset) |
| axios | HTTP client (2Factor.in API, push notifications) |
| twilio | Legacy SMS (welcome messages only) |
| dotenv | Environment variable loading |
| nodemon (dev) | Auto-reload dev server |

### Mobile (`mobile/package.json`) — selected highlights
| Package | Purpose |
|---|---|
| expo, expo-router, react, react-native | Core framework & routing |
| zustand, @react-native-async-storage/async-storage | State management & persistence |
| axios, socket.io-client | REST & realtime networking |
| @react-navigation/* , react-native-screens, react-native-safe-area-context | Navigation primitives |
| react-native-paper, expo-blur, react-native-reanimated, react-native-gesture-handler | UI, glass effects, animation, gestures |
| expo-image-picker, expo-document-picker, expo-av, expo-file-system, expo-sharing, expo-intent-launcher, expo-web-browser | Media capture, file ops, native document viewing |
| formik, yup | Form state & validation |
| date-fns, react-native-country-picker-modal | Date formatting, phone country selection |
| expo-notifications, expo-haptics, @expo/vector-icons | Push notifications, haptics, icons |
| firebase | Firebase phone auth / push (optional path) |
| typescript, babel-preset-expo | Type safety, build tooling |

### Admin (`admin/package.json`)
| Package | Purpose |
|---|---|
| react, react-dom, react-router-dom | SPA framework & routing |
| @mui/material, @mui/icons-material, @mui/x-data-grid, @emotion/* | UI component library, tables |
| recharts | Dashboard charts (line/pie/bar) |
| axios | API client |
| zustand | Auth state |
| react-toastify | Toast notifications |
| date-fns | Date formatting |
| formik, yup | Present in dependencies but not actively used in current page code |
| vite, @vitejs/plugin-react, typescript | Build tooling, type safety |

### Root (`package.json`)
Minimal placeholder — declares only `typescript` as a devDependency; not a functional workspace root for the three sub-projects (each has its own independent `package.json`/lockfile).

---

## 20. Conclusion

MessCast is a feature-complete, production-deployed real-time chat platform with a clean three-tier separation (backend API/realtime server, mobile client, admin web client) sharing a single MongoDB data layer and Cloudinary-backed media storage. The codebase demonstrates active, iterative production hardening — evidenced by its recent commit history (Cloudinary migration, EAS build setup, keyboard/UX fixes, voice-playback stabilization, and a from-scratch native document-viewer rebuild).

**For a new developer joining the project**, the recommended ramp-up path is:
1. Run the stack locally via `docker-compose.yml` (backend + MongoDB) and `npm run dev` for the admin panel; use Expo Go or an EAS development build for the mobile app
2. Read `backend/src/server.js` to understand middleware/route wiring, then walk through `models/` → `routes/` → `socket/socketHandler.js` to understand the data and event model
3. On mobile, start at `app/_layout.tsx` (navigation guard) → `store/` (Zustand stores) → `hooks/useSocket.ts` (realtime wiring) → `app/chat/[id].tsx` (the most complex screen)
4. On the admin panel, start at `App.tsx` (routing) → `store/adminAuthStore.ts` → `pages/Dashboard.tsx`

All architectural decisions documented here were derived directly from reading the source files listed throughout each section — no assumptions were made about undocumented behavior. Where a feature's completeness could not be fully verified from the code (e.g., push-notification provider selection, iOS release readiness), it has been explicitly marked "Partial" in §15 rather than assumed complete.
