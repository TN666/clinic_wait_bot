# Clinic Queue Bot

A LINE Bot-based clinic queue notification system that helps users track their position in the clinic's waiting queue and sends notifications when their turn is approaching.

## Features

- Automatic monitoring of clinic queue progress
- Real-time notifications when your turn is approaching
- Support for multiple users simultaneously
- Automatic handling of missed numbers
- Reset functionality
- Comprehensive error handling and retry mechanism

## Tech Stack

- Node.js
- Express.js
- LINE Messaging API
- PostgreSQL
- Docker

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd clinic_wait_bot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
- Copy `config.js` and set up your LINE Bot credentials
- Ensure PostgreSQL database is properly configured

4. Start the service using Docker:
```bash
docker-compose up -d
```

## Usage Instructions

1. Add the bot as a friend on LINE
2. Send the clinic's online queue center URL
3. Enter your queue number
4. The system will automatically monitor the queue progress and send notifications when your turn is approaching
5. To reset your settings, type "reset" or "重置"

## Important Notes

- Please ensure you enter the correct queue center URL
- The system checks queue progress every 30 seconds
- Notifications are sent when your number is within 3 positions of the current number
- If you miss your turn, the system will automatically reset and notify you


## License

ISC License 