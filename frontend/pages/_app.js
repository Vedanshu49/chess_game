import "@/styles/globals.css"
import { AuthProvider } from "@/lib/AuthProvider"
import { ThemeProvider } from "@/lib/ThemeContext"
import { Toaster } from 'react-hot-toast';

import { useEffect } from 'react';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js');
    }
  }, []);
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster />
        <Component {...pageProps} />
      </AuthProvider>
    </ThemeProvider>
  )
}
