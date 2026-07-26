import './App.css'
import LoginPage from './page/LoginPage'
import SignupPage from './page/SignupPage'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './page/Dashboard'
import ProtectedRoute from './route/ProtectedRoute'
import LandingPage from './page/LandingPage'
import SuggestionPage from './page/SuggestionPage'
import RecipeDetailPage from './page/RecipeDetailPage'
import ProfilePage from './page/ProfilePage'
import QuickAddAssistant from './components/QuickAddAssistant'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage/>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path='/dashboard' element={<Dashboard />} />
        <Route path='/dashboard/profile' element={<ProfilePage />} />
        <Route path='/dashboard/recipes' element={<SuggestionPage />} />
        <Route path='/dashboard/recipes/:id' element={<RecipeDetailPage />} />
      </Route>
    <QuickAddAssistant />
    </Routes>
  )
}

export default App
