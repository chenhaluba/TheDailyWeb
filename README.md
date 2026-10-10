# The Daily Web

Final project for the Web Application Development course. The system supports publishing news, reporter and editor workflows, comments, view analytics, user authentication, and a weather widget.

## Technologies

- Node.js and Express
- MongoDB and Mongoose
- EJS, HTML5, CSS, Flexbox and CSS Grid
- Vanilla JavaScript with Fetch/AJAX
- JWT authentication stored in an HTTP-only cookie

## Installation and Running

1. Install Node.js, npm, and MongoDB.
2. Install the project dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env` and set the required values:

   ```env
   PORT=3000
   MONGODB_URI=mongodb://127.0.0.1:27017/the_daily_web
   JWT_SECRET=replace_with_a_long_random_secret
   WEATHER_API_KEY=replace_with_an_openweathermap_api_key
   WEATHER_CITY=Tel Aviv
   ```

4. Create the demonstration data. This command clears the existing project data before inserting the demo data:

   ```bash
   npm run seed
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000`.

## Demo Users

The seed creates reporter and editor users for `yuval`, `noy`, `chen`, `shirK`, and `shirA`.

- Username: `<name>_reporter` or `<name>_editor`
- Password: the matching name

Example: `chen_reporter` / `chen` or `chen_editor` / `chen`.

## Main Features

- Public news feed with search, category filtering, sorting, and infinite scrolling.
- Server-rendered article pages with comments and view tracking.
- Reporter dashboard for creating drafts, autosaving, submitting articles, handling returned articles, and updating published articles.
- Editor dashboard for filtering, reviewing, editing, approving, returning, and deleting articles.
- Separate working and published article versions, including publication history.
- Impact Analytics graph showing views over time and publication events.
- Authentication, role-based authorization, ownership checks, password hashing, and comment rate limiting.
- Cached weather data from OpenWeatherMap.

## Project Structure

- `app.js` - application entry point and route registration.
- `config/` - database connection and shared constants.
- `models/` - Mongoose models for users, articles, comments, and view statistics.
- `controllers/` - HTTP request handling and page rendering.
- `services/` - reusable business logic, queries, workflows, and analytics.
- `middleware/` - authentication, role authorization, ownership, and comment rate limiting.
- `routes/` - public, reporter, editor, user, comment, and analytics endpoints.
- `views/` - EJS pages and reusable partials.
- `public/` - browser JavaScript, stylesheets, and images.
- `scripts/seed.js` - demonstration data generator.
- `tests/` - automated tests for the public feed, articles, comments, and analytics.

## Available Commands

```bash
npm start       # Start the application
npm run dev     # Start with nodemon
npm run seed    # Recreate demonstration data
npm test        # Run the Jest test suite
```

Some integration tests require a configured `.env`, a running MongoDB instance, seeded data, and the application running on port `3000`.

## Security

Do not commit `.env`, passwords, tokens, JWT secrets, or API keys. Only `.env.example` with placeholder values should be committed.