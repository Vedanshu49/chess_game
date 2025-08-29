import { useState } from 'react'
import { supabase } from '@/lib/supabasejs'
import { useRouter } from 'next/router'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Password reset email sent!')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="max-w-md w-full bg-panel p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-text text-center mb-6">Forgot Password</h1>
        <form onSubmit={handleForgotPassword}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-muted mb-2">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#222222] border border-muted text-text focus:outline-none focus:border-accent"
              required
            />
          </div>
          <button
            type="submit"
            className="btn w-full"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Reset Email'}
          </button>
        </form>
        {message && <p className="text-center text-text mt-4">{message}</p>}
        <p className="text-center text-muted mt-4">
          Remember your password?{' '}
          <a href="/login" className="text-accent hover:underline">Login</a>
        </p>
      </div>
    </div>
  )
}