import { useState } from 'react'
import './App.css'
import LoginPage from './page/LoginPage'
import SignupPage from './page/SignupPage'
import { Routes, Route } from 'react-router-dom'


function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
    </Routes>
  )
}

export default App