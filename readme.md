# AI Chat Application

This project is an AI-powered chat application built using the MERN (MongoDB, Express, React, Node.js) stack. The application allows users to register, login, create projects, and collaborate with other users in real-time. It also integrates AI capabilities to assist users with coding tasks.

## Features

- **User Authentication**: Users can register and login to the application.
- **Project Management**: Users can create projects and add collaborators.
- **Real-time Collaboration**: Users can chat and collaborate in real-time.
- **AI Assistance**: The application integrates AI to assist users with coding tasks.
- **File Management**: Users can manage files within their projects.
- **WebContainer Integration**: The application uses WebContainer to run and preview projects in real-time.

## Technologies Used

### Frontend

- **Vite + React**: A JavaScript library for building user interfaces.
- **React Router**: For routing and navigation.
- **Axios**: For making HTTP requests.
- **Socket.io-client**: For real-time communication.
- **Tailwind CSS**: For styling the application.
- **WebContainer**: For running and previewing projects in real-time.

### Backend

- **Node.js**: A JavaScript runtime built on Chrome's V8 JavaScript engine.
- **Express**: A web application framework for Node.js.
- **MongoDB**: A NoSQL database.
- **Mongoose**: An ODM (Object Data Modeling) library for MongoDB and Node.js.
- **Socket.io**: For real-time communication.
- **JWT**: For user authentication.
- **Redis**: For caching and session management.

## Project Structure

### Frontend

- `src/`
    - `auth/`: Contains authentication-related components.
    - `config/`: Contains configuration files for Axios and WebContainer.
    - `context/`: Contains context providers for managing global state.
    - `routes/`: Contains route definitions.
    - `screens/`: Contains the main screens of the application.
    - `index.css`: Global CSS file.
    - `main.jsx`: Entry point of the React application.

### Backend

- `controllers/`: Contains controller functions for handling requests.
- `database/`: Contains database connection setup.
- `middleware/`: Contains middleware functions.
- `models/`: Contains Mongoose models.
- `routes/`: Contains route definitions.
- `services/`: Contains service functions for business logic.
- `app.js`: Main application setup.
- `server.js`: Entry point of the Node.js server.

## Getting Started

### Prerequisites

- Node.js
- MongoDB
- Redis

### Installation

1. Clone the repository:
     ```bash
     git clone https://github.com/your-username/ai-chat-app.git
     cd ai-chat-app
     ```

2. Install dependencies for the frontend:
     ```bash
     cd frontend
     npm install
     ```

3. Install dependencies for the backend:
     ```bash
     cd ../backend
     npm install
     ```

### Environment Variables

Create a `.env` file in the `backend` directory and add the following environment variables:

```
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port
REDIS_PASSWORD=your_redis_password
GOOGLE_AI_KEY=your_google_ai_key
```

### Running the Application

1. Start the backend server:
     ```bash
     cd backend
     npm start
     ```

2. Start the frontend development server:
     ```bash
     cd ../frontend
     npm run dev
     ```

3. Open your browser and navigate to `http://localhost:3000`.

## Usage

1. Register a new account or login with an existing account.
2. Create a new project and add collaborators.
3. Start chatting and collaborating in real-time.
4. Use the AI assistant by starting your message with `@ai`.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

This project is licensed under the MIT License.

## Acknowledgements

- [React](https://reactjs.org/)
- [Express](https://expressjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Socket.io](https://socket.io/)
- [Tailwind CSS](https://tailwindcss.com/)
- [WebContainer](https://webcontainers.io/)
