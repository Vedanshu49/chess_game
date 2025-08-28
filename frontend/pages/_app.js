import "@/styles/globals.css"
import { AuthProvider } from "@/lib/AuthProvider"
import { ThemeProvider } from "@/lib/ThemeContext"
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster />
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  )
}
