# GymBuddy — Product Requirements Document

## Original Problem Statement
Build a complete, production-ready Android fitness app "GymBuddy" (React Native/Expo + TypeScript, secure FastAPI backend, MongoDB). Full feature set: onboarding, equipment system, 500+ exercise DB with muscle visualization, workout plans + custom builder, active workout with rest timer, progress tracking + charts + BMI + goal estimation, food tracking with barcode (Open Food Facts), gamification, opt-in leaderboards, 5 languages (DE/EN/ES/FR/IT), in-app admin dashboard, subscriptions prepared, strong security & user-data safety.

## User Choices
- Auth: JWT email+password with admin login.
- Subscriptions: prepared (Free/Premium) WITHOUT payment system.
- Exercise media: app-internal SVG illustrations + muscle diagrams (no external images).
- Scope: everything at once incl. full food segment (Open Food Facts covers all products incl. store bakery via barcode/search).
- Admin: protected in-app admin area. Any admin can promote users; ONLY root admin can demote. Promoted admins get the admin button.

## Architecture
- Backend: `/app/backend/server.py` (FastAPI, motor async, JWT/bcrypt), `exercise_data.py` (1306 generated exercises w/ 5-lang names+instructions, equipment/muscle metadata), `templates_data.py` (8 predefined plans). Env: MONGO_URL, DB_NAME, JWT_SECRET, ROOT_ADMIN_EMAIL/PASSWORD.
- Frontend: Expo Router. `src/theme.ts` (dark-first + light tokens, makeStyles/useTheme), `src/i18n/*` (en/de/es/fr/it dictionaries), `src/api.ts` (fetch+bearer), `src/context.tsx` (AppProvider: auth/lang/theme), `src/components/ui.tsx` + `MuscleFigure.tsx` (internal SVG front/back muscle map), `src/pickStore.ts`.
- Data safety: soft deletes (deleted_at), non-destructive exercise overrides, idempotent root-admin bootstrap on startup.

## User Personas
- Beginner wanting guided plans & simple tracking.
- Intermediate/advanced lifter building custom plans, tracking PRs & volume.
- Home trainer with limited equipment (equipment-aware recommendations).
- Admin/operator managing users, content and media audit.

## Core Requirements (static)
- Secure JWT auth + role/root-admin authorization; equipment-aware exercise availability (ALL required equipment must be owned); real charts that survive empty data; full localization (no hardcoded UI text); privacy (leaderboards opt-in, no body data exposed).

## Implemented (2026-06)

### Update 6 — Super-admin fix
- ROOT_ADMIN_EMAIL changed to `myscraptv@gmail.com`; startup bootstrap promotes that existing account (password preserved) and now ENFORCES on every startup that only this email holds `root_admin` (all others demoted). Registration auto-grants root for this email only. Old test admin `admin@gymbuddy.app` stays a regular (non-root) admin. Verified by testing_agent: 12/12 (single-root invariant, root protection vs regular admin, restart idempotency).

### Update 5 — Full photo coverage + Instagram-style Explore
- Photo coverage now 100% (1306/1306): 721 exact name+muscle matches + 585 representative photos (same muscle group). Detail screen labels representative photos ("Beispielfoto für diese Muskelgruppe"). Map in `exercise_media.py` includes `match: exact|representative`; backend exposes `photo_match`.
- New EXPLORE screen (`/app/frontend/app/explore.tsx`): Instagram-style 3-column photo grid of public image posts with like/comment counts; tapping a tile opens the post (like + comment). Search bar toggles to a People results list (remount via distinct FlatList keys to avoid numColumns crash). Feed search button now routes to /explore; old user-search modal removed. Backend `GET /explore` returns public image posts.

### Update 4 — Real exercise photos
- REAL execution PHOTOS from Free Exercise DB (public domain, jsDelivr CDN). 721/1306 exercises matched confidently by normalized name + primary-muscle compatibility. Map in `/app/backend/exercise_media.py` (id -> {images:[start,end]}). Backend adds `photos`/`photo_attribution` to `localize_exercise`.
- Exercise detail: new "Execution" card auto-cycles start/end photos (GIF-like), tap to toggle manually, dots indicator; SVG muscle diagram + legend retained below as fallback for the ~585 unmatched exercises.
- Exercise browser list: real photo thumbnail when available, else the SVG muscle figure.
- Videos NOT included (Free DB is photos-only). True video/GIF would need a paid ExerciseDB/RapidAPI key.

### Update 3 — Comment moderation
- Comments can be EDITED and DELETED: users manage their own comments; admins can edit/delete ANY comment on ANY post (backend enforces owner-or-admin, 403 otherwise). Edited comments show an "edited" marker. Web uses confirm dialog, native uses Alert.

### Update 2 — Social, media & reminders
- Exercise demonstration ANIMATIONS: self-created reanimated SVG motion per movement pattern with working muscles highlighted (exercise detail).
- Interactive BMI SCALE: tap BMI card to expand colored zone scale with marker.
- Active workout START button: free workouts no longer auto-run timer; add exercises then Start (plan workouts auto-start). Per-exercise adjustable REST (±15s).
- GALLERY: upload photos, per-photo public/private toggle; public photos on public profile.
- Local REMINDERS (expo-notifications): workout/weight/meal with editable times + permission flow (full behavior needs native build).
- Social FEED tab: text/photo/record posts, like, comment; feed & search show ONLY public profiles; private profiles excluded and their profile returns 403. Public profile never exposes body weight/measurements/private photos.
- Backend: /gallery, /posts, /feed, like/comments, /users/search, /users/{id}/profile — privacy verified via curl + screenshots. Now 5 tabs (Home/Feed/Workouts/Progress/Profile).

- 11-step validated onboarding; editable profile + settings; avatar via image picker; units/language/theme; notifications & privacy toggles; data export; account soft-delete.
- 1306-exercise DB; browser with search/muscle/difficulty/available-only filters + pagination; detail with SVG muscle diagram (front/back), localized instructions, alternatives, history, PB.
- Equipment filtering verified (dumbbells+bench includes Dumbbell Bench Press, excludes Barbell Bench Press). 
- 8 predefined templates + auto-generate (equipment/goal/experience aware) + custom builder (days, drag-reorder exercises, sets/reps/weight/rest, warmup/dropset).
- Active workout: complete sets, edit weight/reps, add/remove sets, auto rest-timer, add exercise, cancel/finish with XP+PR+achievement summary.
- Progress: bodyweight/volume/frequency charts (gifted-charts), BMI + category + healthy range + disclaimers, goal estimation (diff/trend/ETA), PR list, streaks.
- Food: OFF search + barcode scan (expo-camera w/ permission flow) + manual entry + meals + daily macro totals.
- Gamification (XP/levels/achievements/streaks/weekly challenges); opt-in leaderboards (xp/streak/workouts).
- In-app Admin: overview, users (promote/demote per root rules, disable/enable), media audit, reports.
- Subscriptions Free/Premium toggle (no payment).
- Backend 21/21 pytest passed; frontend flows verified in preview.

## Backlog / Remaining
- P1: body measurements detail (chest/waist/etc.) UI + progress photos gallery; food favorites/custom-food UI surfacing; per-exercise "replace" in active workout.
- P1: local scheduled notifications (reminders) — requires native build.
- P2: supersets grouping UI; imperial unit conversion display; admin exercise translation editor; RevenueCat payment when monetizing.
- P2: Android production build via Publish; Play Store assets/docs.

## Next Tasks
1. Progress photos + full body measurements screen.
2. Surface food favorites & custom foods; quick re-add.
3. In-workout exercise replace + superset grouping.
