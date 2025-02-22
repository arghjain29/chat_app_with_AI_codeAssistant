import AppRoutes from "./routes/AppRoutes.jsx";
import { UserProvider } from "./context/userProvider.jsx";

function App() {
  return (
    <UserProvider>
      <AppRoutes />
    </UserProvider>
  );
}

export default App;
