import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/clerk-react";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Today from "./pages/Today";
import Roles from "./pages/Roles";
import Goals from "./pages/Goals";
import Tasks from "./pages/Tasks";
import Inbox from "./pages/Inbox";
import Finance from "./pages/Finance";
import Wishlist from "./pages/Wishlist";
import Timeline from "./pages/Timeline";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/sign-in/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
              <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
            </div>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
            </div>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Today />} />
          <Route path="roles" element={<Roles />} />
          <Route path="goals" element={<Goals />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="inbox" element={<Inbox />} />
          <Route path="finance" element={<Finance />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="timeline" element={<Timeline />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
