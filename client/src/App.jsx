import { useState } from 'react'
import './App.css'
import LoginPage from './page/LoginPage'
import SignupPage from './page/SignupPage'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './page/Dashboard'
import ProtectedRoute from './route/ProtectedRoute'
import LandingPage from './page/LandingPage'


function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage/>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path='/dashboard' element={<Dashboard />} />
      </Route>
    </Routes>
  )
}

export default App