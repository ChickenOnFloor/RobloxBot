# BGSI Trading Bot Backend

This is the backend API server for the BGSI Pet Trading Bot system.

## Features

- **RESTful API** for pet trading operations
- **MongoDB Integration** for data persistence
- **CORS Support** for cross-origin requests
- **Environment Variables** for configuration
- **User Verification** system
- **Trade History** tracking
- **Pending Requests** management

## Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Create Environment File:**
   Create a `.env` file in the backend directory:
   ```env
   # MongoDB Connection
   MONGODB_URI=mongo_api_url
   
   # Server Configuration
   PORT=3000
   NODE_ENV=development
   
   # CORS Configuration
   FRONTEND_URL=http://localhost:8080
   ```

3. **Start the Server:**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Health Check
- `GET /api/health` - Check API status

### User Management
- `GET /api/verify-user?username={username}` - Verify user exists
- `GET /api/user-balance/{username}` - Get user's pet balance
- `GET /api/user-available-pets/{username}` - Get available pets for user

### Trading Operations
- `POST /api/deposit` - Create deposit request
- `POST /api/withdraw` - Create withdrawal request
- `GET /api/get-pending-requests?bot={bot}` - Get pending requests for bot
- `POST /api/complete-deposit` - Complete deposit transaction
- `POST /api/complete-withdraw` - Complete withdrawal transaction

### History
- `GET /api/trade-history?username={username}&limit={limit}` - Get trade history

## Database Collections

- `users` - User accounts
- `userPetBalances` - Pet balances for each user
- `tradeHistory` - All trade transactions
- `pendingTradeRequests` - Pending trade requests
- `botAccounts` - Bot account information

## Configuration

The backend uses environment variables for configuration:

- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `FRONTEND_URL` - Frontend URL for CORS

## Development

- **Hot Reload:** `npm run dev` (uses nodemon)
- **Production:** `npm start`
- **Logs:** Check console for detailed logs 
