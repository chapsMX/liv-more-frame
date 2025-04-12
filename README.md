# Liv More
Turn healthy habits into rewards!
A Farcaster MiniApp for the Eth Denver 2025 Hackaton

## About
Liv More is a blockchain-powered platform that gamifies health and wellness by allowing users to create and participate in verified challenges based on sleep, recovery, and fitness data from wearables like Oura, Garmin, and more. Users stake entry fees, complete challenges, and win rewards—all secured by smart contracts. Liv More App drives motivation, accountability, and crypto adoption through real-world incentives.

## Architecture

### Frontend
- **Framework**: Next.js 14 with App Router
- **Styling**: TailwindCSS
- **UI Components**: Custom components with Proto Mono font
- **State Management**: React hooks and context

### Backend
- **API Routes**: Next.js API routes with TypeScript
- **Database**: PostgreSQL on Neon DB
- **Authentication**: Farcaster Frame authentication
- **External APIs**:
  - Google Fit API for activity data
  - Neynar API for Farcaster user data

### Key Features
- **User Authentication**: Farcaster-based authentication system
- **Whitelist System**: Managed access control for early users
- **Activity Tracking**:
  - Calories burned tracking
  - Steps counter
  - Sleep hours monitoring
- **Goals Management**:
  - Custom daily goals setting
  - Real-time progress tracking
  - Visual progress indicators

### Data Flow
1. User authenticates via Farcaster
2. Whitelist verification
3. Google Fit connection setup
4. Daily goals definition
5. Real-time activity tracking
6. Progress visualization

## Awards and Recognition

### BUIDL WEEK by Base
Liv More winner at the "Build a Farcaster Mini App" track.
[Twitter](https://x.com/buildonbase/status/1897391136270106928)<br />

### Just Frame It
Liv More was announced as a selected team in the "Just Frame It" program
[Website](https://frame-it.builders.garden/)<br />

## Development

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Google Cloud Platform account
- Farcaster developer account

### Environment Variables
```env
DATABASE_URL=your_neon_db_url
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
```

### Installation
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Source
Project forked from the Frames V2 Repo
[GitHub](https://github.com/farcasterxyz/frames-v2-demo)<br />

## Links
[👀 WebSite](https://livmore.life/) (Mobile only)<br/>
[📦 Devfolio](https://devfolio.co/projects/liv-more-015f)<br/>

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## License
This project is licensed under the MIT License - see the LICENSE file for details.
