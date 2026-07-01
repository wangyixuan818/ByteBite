# ByteBite
## Overview
ByteBite is a food tracking app designed around minimal effort. Unlike existing apps that demand detailed manual entry, ByteBite uses smart defaults and quick-add so users actually stick with it. This includes features:
- Fridge Catalogue
- Automatic Expiry Assignment
- Expiry Alerts & Notifications
- Recipe recommendations
- Simplified Input Methods (Upcoming)
- Search & Filter (Upcoming)

For more details on our project, click on the following [link](https://docs.google.com/document/d/1hNrYeo5fJdf_0mjRjhBH34OTsWTYUxQnUiKmTPZxvQE/edit?usp=sharing).

---

## Getting Started
Follow these steps to set up ByteBite locally on your machine.

### Prerequisites
Before starting, ensure you have the following installed:
* **Node.js (v22 or higher)**
* **npm** (comes bundled with Node)
* **Git**

---

### Step 1: Provision Your Database (Supabase)
ByteBite requires a live PostgreSQL instance to run. Set this up first to get your connection credentials:

1. Create a free account and a new project on the [Supabase Dashboard](https://supabase.com).
2. Go to the **SQL Editor** tab in your Supabase project sidebar.
3. Paste the contents of `docs/schema.sql` into the editor and click **Run** to generate your database tables.
4. Open a new SQL query tab, paste the contents of `docs/foodTypes.sql`, and click **Run** to populate your baseline categories, food types, and brand products.
5. To enable recipe recommendations, run `docs/recipes.sql`, then run `docs/seed_recipes.sql`.
6. Click the blue **Connect** button in the top right corner of your Supabase dashboard header.
7. In the modal that appears, select **Direct connection** (or **Session Pooler** if your local network doesn't support IPv6), copy the URI string, and make sure to replace `[YOUR-PASSWORD]` with your actual database password. Keep this string handy for Step 3.


### Step 2: Clone the Repository
Open your terminal and run the following commands to clone the code and enter the project folder:
```bash
git clone [https://github.com/wangyixuan818/ByteBite.git](https://github.com/wangyixuan818/ByteBite.git)
cd ByteBite
```

### Step 3: Configure backend secrets
Create a new file named `server/.env`. Use `server/.env.example` as a template.
- DATABASE_URL: The Session Pooler URI string you copied from Supabase in Step 1
- JWT_SECRET: A custom random string of your choice, at least 32 characters long, used for login security. To generate a professional one, run this command in your terminal and copy the result:  
    ```bash node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")```     
    ⚠️ Important: Never commit this .env file to Git. It is private to your local machine. `server/.env` is gitignored.


### Step 4: Open a New Terminal and start the Backend Server
Open a new terminal window, navigate to the server directory, and run:
```bash
cd server
npm install
npm run bite
```
You should see: `Server running on http://localhost:5001`

### Step 5: Start the Frontend Server
Open another new terminal window, navigate to the client directory, and run:
```bash
cd client
npm install
npm run dev
```
You should see: `Local: http://localhost:5173`

### Step 6: Open the Application
Visit **http://localhost:5173** in your browser.   
_Note: The frontend is pre-configured to automatically route any /api/* requests directly to your backend server running on port 5001. You do not need to configure any extra endpoints or handle CORS errors manually._


---

## Testing

The backend ships with a Jest suite covering unit tests (schema validation, date helpers, expiry-pick logic) and integration tests (auth, items, food types, notifications, expiry-alert cron).

### Step 1: Provision a Separate Test Database (Supabase)
The test suite writes and deletes rows freely, so it needs its own database — **do not point it at your dev database from Setup Step 1** or your dev data will be wiped.

1. On the [Supabase Dashboard](https://supabase.com), create a **second** project (e.g. `bytebite-test`), separate from the one you created during setup.
2. Go to the **SQL Editor** tab in this new project's sidebar.
3. Paste the contents of `docs/schema.sql` and `docs/recipes.sql` into the editor and click **Run**.
4. Open a new SQL query tab, paste the contents of `docs/foodTypes.sql` and `docs/seed_recipes.sql`, and click **Run**.
5. Click the blue **Connect** button in the top right corner and copy the connection URI (Direct connection, or Session Pooler if your network doesn't support IPv6). Replace `[YOUR-PASSWORD]` with your actual database password.

### Step 2: Add Test Secrets to `server/.env`
Append the following two variables to the `server/.env` file you created in Setup Step 3:

- **TEST_DATABASE_URL**: The URI string from the test project you just created.
- **TEST_JWT_SECRET**: A second random string generated the same way as `JWT_SECRET`:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```

Jest automatically swaps `DATABASE_URL` and `JWT_SECRET` to these test values before any test runs, so your dev database is never touched.

### Step 3: Run the Suite
The backend server does **not** need to be running — Jest boots the Express app in-process against the test database.

From the `server/` directory:

```bash
npm test
```

To generate a coverage report:

```bash
npm run test:coverage
```

