# Insurance Policy Management System - Specification

## Project Overview

- **Project Name**: Insurance Policy Management System
- **Type**: SaaS Web Application
- **Core Functionality**: Insurance agents can record policy sales, track business analytics, and manage policies
- **Target Users**: Insurance agents and administrators

---

## Tech Stack

### Frontend
- React (Vite)
- TypeScript
- Tailwind CSS
- ShadCN UI
- React Hook Form + Zod
- Recharts for charts
- React Router DOM
- Axios for API calls

### Backend
- Python Flask
- Flask-RESTful
- Flask-JWT-Extended
- Flask-CORS
- SQLAlchemy
- PostgreSQL

### Database
- PostgreSQL (SQLite for local development, PostgreSQL for production/cloud)

### Cloud Database Options
- Supabase (Recommended - free tier available)
- Neon
- Railway
- Render

---

## UI/UX Specification

### Design System

#### Color Palette
- **Background**: `#0f0f0f` (dark), `#ffffff` (light mode base)
- **Card Background**: `#1a1a1a` (dark), `#ffffff` (light)
- **Border**: `#262626` (dark), `#e5e5e5` (light)
- **Primary**: `#6366f1` (Indigo-500)
- **Primary Hover**: `#4f46e5` (Indigo-600)
- **Success**: `#22c55e` (Green-500)
- **Warning**: `#f59e0b` (Amber-500)
- **Error**: `#ef4444` (Red-500)
- **Text Primary**: `#fafafa` (dark), `#171717` (light)
- **Text Secondary**: `#a1a1aa` (dark), `#737373` (light)
- **Accent**: `#8b5cf6` (Violet-500)

#### Typography
- **Font Family**: "Inter", system-ui, sans-serif
- **Headings**: 
  - H1: 32px, font-weight 700
  - H2: 24px, font-weight 600
  - H3: 20px, font-weight 600
  - H4: 16px, font-weight 600
- **Body**: 14px, font-weight 400
- **Small**: 12px, font-weight 400

#### Spacing
- Base unit: 4px
- Card padding: 24px
- Section gap: 24px
- Component gap: 16px

#### Border Radius
- Small: 6px
- Medium: 8px
- Large: 12px
- XL: 16px

### Layout Structure

#### Sidebar (240px width)
- Logo at top
- Navigation items with icons
- Active state indicator
- User profile at bottom

#### Main Content Area
- Top navbar (64px height)
- Page content with max-width 1400px
- Responsive padding

### Components

#### Cards
- Background: card background color
- Border: 1px solid border color
- Border radius: 12px
- Padding: 24px
- Shadow: subtle box-shadow

#### Tables
- Striped rows
- Hover state on rows
- Sortable headers
- Pagination controls

#### Forms
- Input fields with labels
- Validation error messages
- Select dropdowns
- Date pickers

#### Buttons
- Primary: Indigo background
- Secondary: Ghost/outline style
- Hover animations (scale 1.02)
- Loading state with spinner

### Animations
- Page transitions: fade in (200ms)
- Card hover: subtle lift effect
- Button hover: scale(1.02)
- Chart animations: smooth draw

---

## Database Schema

### users table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'agent',
    name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### companies table
```sql
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    insurance_type VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### policies table
```sql
CREATE TABLE policies (
    id SERIAL PRIMARY KEY,
    insurance_type VARCHAR(50) NOT NULL,
    company VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    product VARCHAR(100) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100) UNIQUE NOT NULL,
    policy_term INTEGER,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    premium_mode VARCHAR(50) NOT NULL,
    base_premium DECIMAL(12, 2) NOT NULL,
    rider_premium DECIMAL(12, 2) DEFAULT 0,
    gst DECIMAL(12, 2) NOT NULL,
    total_premium DECIMAL(12, 2) NOT NULL,
    policy_status VARCHAR(50) NOT NULL,
    agent_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password, returns JWT token

### Policies
- `GET /api/policies` - List all policies (supports pagination, search, filters)
- `POST /api/policies` - Create new policy
- `GET /api/policies/:id` - Get policy by ID
- `PUT /api/policies/:id` - Update policy
- `DELETE /api/policies/:id` - Delete policy
- `GET /api/policies/export` - Export policies as CSV

### Companies (Admin only)
- `GET /api/companies` - List all companies
- `POST /api/companies` - Create new company
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Soft delete company

### Users (Admin only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Deactivate user

### Analytics
- `GET /api/analytics/summary` - Dashboard summary stats
- `GET /api/analytics/premium-by-type` - Premium by insurance type
- `GET /api/analytics/monthly-revenue` - Monthly revenue trend

---

## Page Specifications

### 1. Login Page
- Centered card with logo
- Email and password fields
- Role indicator (Admin/Agent)
- Submit button with loading state
- Error message display

### 2. Dashboard Page
- 4 stat cards in a row (responsive grid)
- Pie chart for policy distribution
- Bar chart for premium by type
- Line chart for monthly revenue
- Recent policies table (5 items)

### 3. Add Policy Page
- Step indicator at top
- Multi-step form with 4 steps:
  1. Insurance Type selection
  2. Company selection (dynamic based on type)
  3. Product selection (dynamic based on type)
  4. Policy details form
- Progress persistence during form
- Validation at each step

### 4. Policy List Page
- Search bar
- Filter dropdowns
- Sortable table
- Pagination (10 per page)
- Edit/Delete actions

### 5. Analytics Page
- Multiple chart cards
- Premium by company (bar)
- Premium by type (pie)
- Agent performance (bar)
- Monthly growth (line)

### 6. Companies Management Page (Admin only)
- List all insurance companies
- Add new company form
- Edit/Delete actions
- Filter by insurance type

### 7. Users Management Page (Admin only)
- List all users (agents)
- Add new user form
- Edit/Deactivate actions
- Role display

### 8. Export Feature
- Export button on policy list
- Download as CSV
- Includes all policy fields

---

## Functionality

### Authentication Flow
1. User enters email/password
2. API validates and returns JWT
3. Token stored in localStorage
4. Token sent in Authorization header
5. Protected routes check token validity

### Policy Creation Flow
1. Select insurance type
2. Filter companies by type
3. Filter products by type
4. Fill policy details
5. Auto-calculate GST and total
6. Save to database

### Dashboard Flow
1. Fetch summary data on mount
2. Display loading skeletons
3. Render charts with data
4. Update on filter changes

---

## Acceptance Criteria

1. Login page authenticates users successfully
2. Dashboard displays all analytics correctly
3. Policy creation works with all validation
4. Policy list supports search, filter, sort, pagination
5. Analytics page shows all charts
6. UI matches modern SaaS aesthetic
7. Responsive on mobile/tablet
8. No console errors in production
9. API endpoints return correct data
10. Database schema is correct
11. Companies can be added/edited/deleted by admin
12. Users can be added/edited/deactivated by admin
13. Policies can be exported as CSV
14. Advanced search with multiple filters works correctly

---

## Project Structure

```
D:\Insurance\
├── frontend/           # React Vite project
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── utils/
│   │   └── ...
│   └── ...
├── backend/            # Flask API
│   ├── app.py
│   ├── config.py
│   ├── models/
│   ├── routes/
│   └── ...
└── README.md
```