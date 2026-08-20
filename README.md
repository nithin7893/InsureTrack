# Insurance Policy Management System

A production-grade SaaS web application for insurance agents to record policy sales and track business analytics.

## Tech Stack

### Frontend
- React (Vite) + TypeScript
- Tailwind CSS
- ShadCN UI Components
- React Hook Form + Zod
- Recharts for data visualization
- React Router DOM

### Backend
- Python Flask
- Flask-JWT-Extended for authentication
- Flask-SQLAlchemy
- PostgreSQL

## Project Structure

```
D:\Insurance\
├── frontend/                 # React Vite frontend
│   ├── src/
│   │   ├── components/      # UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API services
│   │   ├── hooks/           # Custom React hooks
│   │   ├── types/           # TypeScript types
│   │   └── utils/           # Utility functions
├── backend/                 # Flask backend
│   ├── app.py              # Main application
│   ├── models.py           # SQLAlchemy models
│   ├── routes/             # API routes
│   └── requirements.txt    # Python dependencies
└── SPEC.md                 # Project specification
```

## Features

- **Authentication**: JWT-based login system with Admin and Agent roles
- **Dashboard**: Analytics cards, policy distribution charts, monthly revenue trends
- **Add Policy**: Multi-step wizard with smart form validation and auto GST calculation
- **Policy List**: Searchable, filterable, sortable table with pagination
- **Analytics**: Premium by company, premium by type, agent performance charts

## Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL

### Backend Setup

1. Create a PostgreSQL database:
```sql
CREATE DATABASE insurance_db;
```

2. Navigate to backend directory:
```bash
cd backend
```

3. Create virtual environment and install dependencies:
```bash
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will run on http://localhost:5000

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file (optional - uses defaults):
```env
VITE_API_URL=http://localhost:5000
```

4. Start development server:
```bash
npm run dev
```

The frontend will run on http://localhost:5173

## Demo Credentials

- **Admin**: admin@insurance.com / admin123
- **Agent**: agent@insurance.com / agent123

## API Endpoints

### Authentication
- POST `/api/auth/login` - Login

### Policies
- GET `/api/policies` - List policies (with pagination, search, filters)
- POST `/api/policies` - Create policy
- GET `/api/policies/:id` - Get policy
- PUT `/api/policies/:id` - Update policy
- DELETE `/api/policies/:id` - Delete policy

### Analytics
- GET `/api/analytics/summary` - Dashboard summary
- GET `/api/analytics/premium-by-type` - Premium by type
- GET `/api/analytics/monthly-revenue` - Monthly revenue
- GET `/api/analytics/premium-by-company` - Premium by company
- GET `/api/analytics/agent-performance` - Agent performance

## Insurance Types & Products

### Life Insurance
- Companies: LIC, HDFC Life, Axis Max Life, ICICI Prudential, GoDigit, Bajaj Life, SBI Life
- Category: Linked, Non Linked
- Products: Term Plan, Return of Premium, Annuity, Savings, ULIP, Pension
- GST: 0%

### Health Insurance
- Companies: Care, Star, ICICI Lombard, New India, United India, Chola, Reliance, Tata AIG, National Insurance, Royal Sundaram, HDFC Ergo
- Products: Individual, GMC, Travel, Personal Accident, Topup
- GST: 18% for GMC & Travel, 0% for others

### General Insurance
- Companies: ICICI Lombard, New India, United India, Chola, Reliance, Tata AIG, GoDigit, National Insurance, Oriental, Royal Sundaram, Magma
- Products: Motor, Marine Hull, Marine Transit, Miscellaneous, Fire, Engineering, Liability Insurance
- GST: 18%

## Production Build

```bash
# Frontend
cd frontend
npm run build

# Backend (using gunicorn)
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:create_app()
```