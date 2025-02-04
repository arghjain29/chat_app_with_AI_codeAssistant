import AppRoutes from "./routes/AppRoutes.jsx";
import { UserProvider } from "./context/user.context.jsx";

function App() {
  return (
    <UserProvider>
      <AppRoutes />
    </UserProvider>
  );
}

export default App;
