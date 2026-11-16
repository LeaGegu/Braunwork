import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import AdminDashboard from './admin/AdminDashboard.jsx'
import InquiryManagement from './admin/InquiryManagement.jsx'
import AdminLogin from './admin/AdminLogin.jsx'
import CompleteInvitation from './admin/CompleteInvitation.jsx'
import StaffManagement from './admin/StaffManagement.jsx'
import ProtectedRoute from './admin/ProtectedRoute.jsx'
import NotFound from './pages/NotFound.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/invite" element={<CompleteInvitation />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route index element={<AdminDashboard />} />
            <Route path="inquiries/:inquiryId?" element={<InquiryManagement />} />
            <Route path="staff" element={<StaffManagement />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
