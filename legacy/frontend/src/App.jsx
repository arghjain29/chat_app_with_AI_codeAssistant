import AppRoutes from "./routes/AppRoutes.jsx";
import { UserProvider } from "./context/userProvider.jsx";
import { ToastProvider } from "./components/ToastContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

function App() {
  return (
    <ErrorBoundary>
      <UserProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </UserProvider>
    </ErrorBoundary>
  );
}

export default App;
