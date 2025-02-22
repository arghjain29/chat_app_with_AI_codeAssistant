/* eslint-disable react/prop-types */
import { useState } from "react";
import { UserContext } from "./userContext.jsx";

// Create a provider component
export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
};

