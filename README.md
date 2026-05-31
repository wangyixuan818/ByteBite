# ByteBite
## Overview
ByteBite is a food tracking app designed around minimal effort. Unlike existing apps that demand detailed manual entry, ByteBite uses smart defaults and quick-add so users actually stick with it. This includes features:
- Fridge Catalogue
- Automatic Expiry Assignment & Alerts (Upcoming)
- Recipe recommendations (Upcoming)
- Simplified Input Methods (Upcoming)
- Search & Filter (Upcoming)

For more details on our project, click on the following [link](https://docs.google.com/document/d/1__Zo9HurXBK9_cGoRiBS-UuuTrlllRaOE4FxJ0Q5j8k/edit?usp=sharing).

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
4. Open a new SQL query tab, paste the contents of `docs/foodTypes.sql`, and click **Run** to populate your baseline `food_types` registry.
5. Click the blue **Connect** button in the top right corner of your Supabase dashboard header.
6. In the modal that appears, select **Direct connection** (or **Session Pooler** if your local network doesn't support IPv6), copy the URI string, and make sure to replace `[YOUR-PASSWORD]` with your actual database password. Keep this string handy for Step 3.


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
```bash
npm install
npm run bite
```
You should see: `Server running on http://localhost:5001`

### Step 5: Open a New Terminal and start the FrontEnd Server
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

## TESTING (Milestone 1)
### Testing Backend: Running the E2E Test Suite
**Prerequisites:**
1. Ensure your local Postgres database is running and seeded.
2. Ensure your Express server is running on `http://localhost:5001`.

**Execution:**
Navigate to the root of the project and run the bash script:

```bash
./scripts/ms1BETest.sh
```

